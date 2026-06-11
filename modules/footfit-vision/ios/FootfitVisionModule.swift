import CoreImage
import ExpoModulesCore
import Vision
import UIKit

public class FootfitVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FootfitVision")

    AsyncFunction("detectScene") { (uri: String, promise: Promise) in
      guard let url = Self.resolveURL(uri) else {
        promise.reject("E_URI", "Unable to parse image URI: \(uri)")
        return
      }
      guard let data = try? Data(contentsOf: url), let image = UIImage(data: data), let cgImage = image.cgImage else {
        promise.reject("E_IMAGE", "Unable to load image at URI: \(uri)")
        return
      }

      let orientation = CGImagePropertyOrientation(image.imageOrientation)

      DispatchQueue.global(qos: .userInitiated).async {
        let rectRequest = VNDetectRectanglesRequest()
        rectRequest.minimumAspectRatio = 0.5
        rectRequest.maximumAspectRatio = 0.8
        rectRequest.minimumSize = 0.15
        rectRequest.quadratureTolerance = 25
        rectRequest.maximumObservations = 5

        // Both polarities: dark foot/sock on white paper AND light shapes on
        // dark floor — the picker decides which contours matter
        let contoursDark = VNDetectContoursRequest()
        contoursDark.contrastAdjustment = 3.0
        contoursDark.detectsDarkOnLight = true
        contoursDark.maximumImageDimension = 1024

        let contoursLight = VNDetectContoursRequest()
        contoursLight.contrastAdjustment = 3.0
        contoursLight.detectsDarkOnLight = false
        contoursLight.maximumImageDimension = 1024

        // Rect detection sees the original image (brightness scoring needs real
        // luminance); contour detection sees an illumination-normalized copy
        // (image ÷ blurred image) so soft shadows vanish while sharp foot/paper
        // edges survive
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
        do {
          try handler.perform([rectRequest])
        } catch {
          promise.reject("E_VISION", "Vision rectangle request failed: \(error.localizedDescription)")
          return
        }

        let upright = CIImage(cgImage: cgImage).oriented(orientation)
        do {
          if let normalized = Self.illuminationNormalized(upright) {
            let contourHandler = VNImageRequestHandler(cgImage: normalized, options: [:])
            try contourHandler.perform([contoursDark, contoursLight])
          } else {
            let contourHandler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
            try contourHandler.perform([contoursDark, contoursLight])
          }
        } catch {
          promise.reject("E_VISION", "Vision contour requests failed: \(error.localizedDescription)")
          return
        }

        let orientedImage = CIImage(cgImage: cgImage).oriented(orientation)
        var quad: [[Double]]? = nil
        var candidates: [[String: Any]] = []
        for obs in rectRequest.results ?? [] {
          let q: [[Double]] = [
            [Double(obs.topLeft.x), Double(obs.topLeft.y)],
            [Double(obs.topRight.x), Double(obs.topRight.y)],
            [Double(obs.bottomRight.x), Double(obs.bottomRight.y)],
            [Double(obs.bottomLeft.x), Double(obs.bottomLeft.y)],
          ]
          if quad == nil { quad = q }
          candidates.append([
            "quad": q,
            "brightness": Self.meanBrightness(of: q, in: orientedImage),
          ])
        }

        var contours: [[[Double]]] = []
        for request in [contoursDark, contoursLight] {
          if let observation = request.results?.first as? VNContoursObservation {
            do {
              let flat = try Self.flattenContours(observation)
              contours.append(contentsOf: flat.map { contour in
                contour.normalizedPoints.map { [Double($0.x), Double($0.y)] }
              })
            } catch {
              promise.reject("E_CONTOURS", "Failed to walk contours: \(error.localizedDescription)")
              return
            }
          }
        }

        // Vision results are normalized to the upright image when orientation is supplied
        let swapped: Bool
        switch orientation {
        case .left, .right, .leftMirrored, .rightMirrored:
          swapped = true
        default:
          swapped = false
        }
        promise.resolve([
          "quad": quad as Any,
          "candidates": candidates,
          "contours": contours,
          "width": swapped ? cgImage.height : cgImage.width,
          "height": swapped ? cgImage.width : cgImage.height,
        ])
      }
    }
  }

  // Divide the image by a heavily blurred copy of itself: soft illumination
  // gradients (shadows) flatten out, sharp edges (foot on paper) survive.
  // Downscaled to Vision's working size first to keep the blur cheap.
  private static func illuminationNormalized(_ image: CIImage) -> CGImage? {
    let maxDim = max(image.extent.width, image.extent.height)
    guard maxDim > 0 else { return nil }
    let scale = min(1.0, 1024.0 / maxDim)
    let scaled = scale < 1.0
      ? image.applyingFilter("CILanczosScaleTransform", parameters: [
          kCIInputScaleKey: scale,
          kCIInputAspectRatioKey: 1.0,
        ])
      : image
    let blurred = scaled
      .clampedToExtent()
      .applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: max(scaled.extent.width, scaled.extent.height) * 0.05,
      ])
      .cropped(to: scaled.extent)
    let normalized = blurred.applyingFilter("CIDivideBlendMode", parameters: [
      kCIInputBackgroundImageKey: scaled,
    ])
    let context = CIContext(options: [.workingColorSpace: NSNull()])
    return context.createCGImage(normalized, from: scaled.extent)
  }

  // Mean luminance [0,1] of the quad's bounding box — distinguishes white
  // paper from dark floor/wall tiles that happen to be rectangular
  private static func meanBrightness(of quadNorm: [[Double]], in image: CIImage) -> Double {
    let xs = quadNorm.map { $0[0] }
    let ys = quadNorm.map { $0[1] }
    guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max(),
          maxX > minX, maxY > minY else {
      return 0
    }
    let extent = image.extent
    let rect = CGRect(
      x: extent.origin.x + CGFloat(minX) * extent.width,
      y: extent.origin.y + CGFloat(minY) * extent.height,
      width: CGFloat(maxX - minX) * extent.width,
      height: CGFloat(maxY - minY) * extent.height
    )
    guard let filter = CIFilter(name: "CIAreaAverage", parameters: [
      kCIInputImageKey: image,
      kCIInputExtentKey: CIVector(cgRect: rect),
    ]), let output = filter.outputImage else {
      return 0
    }
    var pixel = [UInt8](repeating: 0, count: 4)
    let context = CIContext(options: [.workingColorSpace: NSNull()])
    context.render(
      output,
      toBitmap: &pixel,
      rowBytes: 4,
      bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
      format: .RGBA8,
      colorSpace: nil
    )
    return (0.299 * Double(pixel[0]) + 0.587 * Double(pixel[1]) + 0.114 * Double(pixel[2])) / 255.0
  }

  private static func resolveURL(_ uri: String) -> URL? {
    if let url = URL(string: uri), url.scheme != nil {
      return url
    }
    return URL(fileURLWithPath: uri)
  }

  private static func flattenContours(_ observation: VNContoursObservation) throws -> [VNContour] {
    var all: [VNContour] = []
    for i in 0..<observation.topLevelContourCount {
      try walk(observation: observation, indexPath: IndexPath(index: i), into: &all)
    }
    return all
  }

  private static func walk(observation: VNContoursObservation, indexPath: IndexPath, into: inout [VNContour]) throws {
    let contour = try observation.contour(at: indexPath)
    into.append(contour)
    for i in 0..<contour.childContourCount {
      var next = indexPath
      next.append(i)
      try walk(observation: observation, indexPath: next, into: &into)
    }
  }
}

extension CGImagePropertyOrientation {
  init(_ uiOrientation: UIImage.Orientation) {
    switch uiOrientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
