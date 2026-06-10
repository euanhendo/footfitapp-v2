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
        rectRequest.maximumObservations = 1

        let contoursRequest = VNDetectContoursRequest()
        contoursRequest.contrastAdjustment = 3.0
        contoursRequest.detectsDarkOnLight = false
        contoursRequest.maximumImageDimension = 1024

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
        do {
          try handler.perform([rectRequest, contoursRequest])
        } catch {
          promise.reject("E_VISION", "Vision requests failed: \(error.localizedDescription)")
          return
        }

        var quad: [[Double]]? = nil
        if let obs = rectRequest.results?.first {
          quad = [
            [Double(obs.topLeft.x), Double(obs.topLeft.y)],
            [Double(obs.topRight.x), Double(obs.topRight.y)],
            [Double(obs.bottomRight.x), Double(obs.bottomRight.y)],
            [Double(obs.bottomLeft.x), Double(obs.bottomLeft.y)],
          ]
        }

        var contours: [[[Double]]] = []
        if let observation = contoursRequest.results?.first as? VNContoursObservation {
          do {
            let flat = try Self.flattenContours(observation)
            contours = flat.map { contour in
              contour.normalizedPoints.map { [Double($0.x), Double($0.y)] }
            }
          } catch {
            promise.reject("E_CONTOURS", "Failed to walk contours: \(error.localizedDescription)")
            return
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
          "contours": contours,
          "width": swapped ? cgImage.height : cgImage.width,
          "height": swapped ? cgImage.width : cgImage.height,
        ])
      }
    }
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
