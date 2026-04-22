import ExpoModulesCore
import Vision
import UIKit

public class FootfitVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FootfitVision")

    AsyncFunction("detectContours") { (uri: String, promise: Promise) in
      guard let url = Self.resolveURL(uri) else {
        promise.reject("E_URI", "Unable to parse image URI: \(uri)")
        return
      }
      guard let data = try? Data(contentsOf: url), let image = UIImage(data: data), let cgImage = image.cgImage else {
        promise.reject("E_IMAGE", "Unable to load image at URI: \(uri)")
        return
      }

      DispatchQueue.global(qos: .userInitiated).async {
        let request = VNDetectContoursRequest()
        request.contrastAdjustment = 3.0
        request.detectsDarkOnLight = false
        request.maximumImageDimension = 1024

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
          try handler.perform([request])
        } catch {
          promise.reject("E_VISION", "VNDetectContoursRequest failed: \(error.localizedDescription)")
          return
        }

        guard let observation = request.results?.first as? VNContoursObservation else {
          promise.resolve([] as [[[Double]]])
          return
        }

        do {
          let contours = try Self.flattenContours(observation)
          let serialized: [[[Double]]] = contours.map { contour in
            contour.normalizedPoints.map { [Double($0.x), Double($0.y)] }
          }
          promise.resolve(serialized)
        } catch {
          promise.reject("E_CONTOURS", "Failed to walk contours: \(error.localizedDescription)")
        }
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
