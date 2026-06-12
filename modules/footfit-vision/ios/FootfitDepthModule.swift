import ARKit
import ExpoModulesCore

public class FootfitDepthModule: Module {
  private var capture: DepthCapture?

  public func definition() -> ModuleDefinition {
    Name("FootfitDepth")

    Function("isDepthSupported") { () -> Bool in
      ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    }

    // Live AR preview with a streamed depth status (centre depth + phone
    // flatness) so screens can coach the user to the right capture height.
    View(FootfitDepthARView.self) {
      Events("onDepthStatus")
    }

    AsyncFunction("captureDepthFrame") { (promise: Promise) in
      DispatchQueue.main.async {
        guard ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
          promise.reject("E_NO_LIDAR", "This device does not support scene depth")
          return
        }

        // Instant path: a mounted live view already owns a running session.
        if let live = FootfitDepthARView.active, let payload = live.currentPayload() {
          promise.resolve(payload)
          return
        }

        if self.capture != nil {
          promise.reject("E_BUSY", "A depth capture is already in progress")
          return
        }
        let capture = DepthCapture { [weak self] result in
          DispatchQueue.main.async {
            self?.capture = nil
            switch result {
            case .success(let frame):
              promise.resolve(frame)
            case .failure(let error):
              promise.reject("E_DEPTH", error.localizedDescription)
            }
          }
        }
        self.capture = capture
        capture.start()
      }
    }
  }
}

// Live ARKit preview view: renders the camera feed and streams a ~4 Hz depth
// status event. Only one is expected on screen at a time; the active one also
// serves captureDepthFrame instantly from its running session.
final class FootfitDepthARView: ExpoView, ARSessionDelegate {
  static weak var active: FootfitDepthARView?

  private let arView = ARSCNView()
  private let session = ARSession()
  private var lastEventAt: TimeInterval = 0
  let onDepthStatus = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    arView.session = session
    session.delegate = self
    addSubview(arView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    arView.frame = bounds
  }

  override func willMove(toWindow newWindow: UIWindow?) {
    super.willMove(toWindow: newWindow)
    if newWindow == nil {
      session.pause()
      if Self.active === self { Self.active = nil }
    } else {
      guard ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else { return }
      let config = ARWorldTrackingConfiguration()
      config.frameSemantics = .sceneDepth
      config.worldAlignment = .gravity
      session.run(config)
      Self.active = self
    }
  }

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard frame.timestamp - lastEventAt > 0.25 else { return }
    lastEventAt = frame.timestamp

    var centerDepthMm: Float = 0
    if let depth = frame.sceneDepth {
      centerDepthMm = Self.centerDepthMetres(depth.depthMap) * 1000
    }
    // How far the phone is from pointing straight down: angle between the
    // camera's look direction and gravity (world −y under .gravity alignment).
    let look = -simd_make_float3(frame.camera.transform.columns.2)
    let cosA = simd_dot(simd_normalize(look), simd_float3(0, -1, 0))
    let flatTiltDeg = acos(max(-1, min(1, cosA))) * 180 / .pi

    let payload: [String: Any] = [
      "centerDepthMm": centerDepthMm,
      "flatTiltDeg": flatTiltDeg,
      "hasDepth": frame.sceneDepth != nil,
    ]
    DispatchQueue.main.async { [weak self] in
      self?.onDepthStatus(payload)
    }
  }

  func currentPayload() -> [String: Any]? {
    guard let frame = session.currentFrame, let depth = frame.sceneDepth else { return nil }
    return DepthCapture.serialise(frame: frame, depth: depth)
  }

  private static func centerDepthMetres(_ map: CVPixelBuffer) -> Float {
    guard CVPixelBufferGetPixelFormatType(map) == kCVPixelFormatType_DepthFloat32 else { return 0 }
    CVPixelBufferLockBaseAddress(map, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(map) else { return 0 }
    let width = CVPixelBufferGetWidth(map)
    let height = CVPixelBufferGetHeight(map)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(map)
    let rowPointer = base.advanced(by: (height / 2) * bytesPerRow)
    let value = rowPointer.assumingMemoryBound(to: Float32.self)[width / 2]
    return value.isFinite ? value : 0
  }
}

// One-shot ARKit session: run with scene depth, let auto-exposure and
// tracking settle for a few frames, serialise the first depth frame after
// that, pause the session. The JS side owns all measurement math.
final class DepthCapture: NSObject, ARSessionDelegate {
  private let session = ARSession()
  private let completion: (Result<[String: Any], Error>) -> Void
  private var framesSeen = 0
  private var finished = false
  private static let warmupFrames = 12 // ~0.2 s at 60 fps
  private static let timeoutSeconds = 5.0

  init(completion: @escaping (Result<[String: Any], Error>) -> Void) {
    self.completion = completion
    super.init()
  }

  func start() {
    session.delegate = self
    let config = ARWorldTrackingConfiguration()
    config.frameSemantics = .sceneDepth
    config.worldAlignment = .gravity
    session.run(config)
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.timeoutSeconds) { [weak self] in
      self?.finish(.failure(NSError(
        domain: "FootfitDepth",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Timed out waiting for a depth frame"]
      )))
    }
  }

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard !finished else { return }
    framesSeen += 1
    guard framesSeen > Self.warmupFrames, let depth = frame.sceneDepth else { return }
    guard let payload = Self.serialise(frame: frame, depth: depth) else { return }
    finish(.success(payload))
  }

  private func finish(_ result: Result<[String: Any], Error>) {
    guard !finished else { return }
    finished = true
    session.pause()
    completion(result)
  }

  static func serialise(frame: ARFrame, depth: ARDepthData) -> [String: Any]? {
    let map = depth.depthMap
    guard CVPixelBufferGetPixelFormatType(map) == kCVPixelFormatType_DepthFloat32 else { return nil }
    CVPixelBufferLockBaseAddress(map, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
    let width = CVPixelBufferGetWidth(map)
    let height = CVPixelBufferGetHeight(map)
    guard let base = CVPixelBufferGetBaseAddress(map) else { return nil }
    let bytesPerRow = CVPixelBufferGetBytesPerRow(map)

    // Row-major Float32 metres, packed contiguously (the buffer may pad rows).
    var data = Data(capacity: width * height * 4)
    for row in 0..<height {
      data.append(Data(bytes: base.advanced(by: row * bytesPerRow), count: width * 4))
    }

    // Per-pixel confidence (0 low / 1 medium / 2 high). Scene depth is
    // RGB-fused: on laser-absorbing surfaces (black fabric) ARKit invents
    // smooth in-between depths and marks them low confidence — the JS side
    // must be able to drop them.
    var confidence = Data()
    if let confMap = depth.confidenceMap,
       CVPixelBufferGetPixelFormatType(confMap) == kCVPixelFormatType_OneComponent8 {
      CVPixelBufferLockBaseAddress(confMap, .readOnly)
      defer { CVPixelBufferUnlockBaseAddress(confMap, .readOnly) }
      if let confBase = CVPixelBufferGetBaseAddress(confMap),
         CVPixelBufferGetWidth(confMap) == width, CVPixelBufferGetHeight(confMap) == height {
        let confBytesPerRow = CVPixelBufferGetBytesPerRow(confMap)
        confidence.reserveCapacity(width * height)
        for row in 0..<height {
          confidence.append(Data(bytes: confBase.advanced(by: row * confBytesPerRow), count: width))
        }
      }
    }

    // Intrinsics describe the full-resolution camera image — rescale to the
    // depth map's own pixel grid.
    let k = frame.camera.intrinsics
    let image = frame.camera.imageResolution
    let sx = Float(width) / Float(image.width)
    let sy = Float(height) / Float(image.height)

    // Gravity in the JS maths' camera convention (x right, y down, z forward).
    // ARKit camera space is x right, y up, z backward; with .gravity world
    // alignment, gravity is world −y.
    let rotation = simd_float3x3(columns: (
      simd_make_float3(frame.camera.transform.columns.0),
      simd_make_float3(frame.camera.transform.columns.1),
      simd_make_float3(frame.camera.transform.columns.2)
    ))
    let gravityCam = simd_mul(rotation.transpose, simd_float3(0, -1, 0))

    return [
      "width": width,
      "height": height,
      "depthBase64": data.base64EncodedString(),
      "confidenceBase64": confidence.isEmpty ? "" : confidence.base64EncodedString(),
      "fx": k[0][0] * sx,
      "fy": k[1][1] * sy,
      "cx": k[2][0] * sx,
      "cy": k[2][1] * sy,
      "gravity": [gravityCam.x, -gravityCam.y, -gravityCam.z],
    ]
  }
}
