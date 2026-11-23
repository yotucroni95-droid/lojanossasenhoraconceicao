// uso: recortar.swift spec.txt pastaPdf pastaSaida
// linha: nome|arquivo.pdf|pagina|x0,y0,x1,y1 (frações, origem no topo)|foto ou recorte
import PDFKit; import AppKit; import Vision; import CoreImage
let a = CommandLine.arguments
let fundo = CIColor(red: 0.965, green: 0.945, blue: 0.918)
let ctx = CIContext()
func salvar(_ img: CGImage, _ caminho: String) {
  let rep = NSBitmapImageRep(cgImage: img)
  try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.82])!.write(to: URL(fileURLWithPath: caminho))
}
for linha in try! String(contentsOfFile: a[1], encoding: .utf8).split(separator: "\n") where !linha.hasPrefix("#") {
  let c = linha.split(separator: "|").map(String.init); if c.count < 5 { continue }
  let d = PDFDocument(url: URL(fileURLWithPath: a[2] + "/" + c[1]))!
  let p = d.page(at: Int(c[2])! - 1)!; let b = p.bounds(for: .mediaBox)
  let f = c[3].split(separator: ",").map { Double($0)! }
  let rot = p.rotation % 180 != 0
  let pw = rot ? b.height : b.width, ph = rot ? b.width : b.height
  let thumb = p.thumbnail(of: NSSize(width: 3600, height: 3600*ph/pw), for: .mediaBox)
  var r0 = CGRect(origin: .zero, size: thumb.size)
  let cheia = thumb.cgImage(forProposedRect: &r0, context: nil, hints: nil)!
  let rect = CGRect(x: f[0]*Double(cheia.width), y: f[1]*Double(cheia.height), width: (f[2]-f[0])*Double(cheia.width), height: (f[3]-f[1])*Double(cheia.height)).integral
  let W = Int(rect.width), H = Int(rect.height)
  var img = cheia.cropping(to: rect)!
  if c[4] == "recorte" {
    let req = VNGenerateForegroundInstanceMaskRequest()
    let h = VNImageRequestHandler(cgImage: img)
    try? h.perform([req])
    if let r = req.results?.first, let mask = try? r.generateScaledMaskForImage(forInstances: r.allInstances, from: h) {
      let m = CIImage(cvPixelBuffer: mask), src = CIImage(cgImage: img)
      // limites do objeto
      var minX = W, minY = H, maxX = 0, maxY = 0
      CVPixelBufferLockBaseAddress(mask, .readOnly)
      let base = CVPixelBufferGetBaseAddress(mask)!.assumingMemoryBound(to: Float32.self)
      let stride = CVPixelBufferGetBytesPerRow(mask) / 4
      for y in 0..<CVPixelBufferGetHeight(mask) { for x in 0..<CVPixelBufferGetWidth(mask) where base[y*stride+x] > 0.5 {
        minX = min(minX,x); maxX = max(maxX,x); minY = min(minY,y); maxY = max(maxY,y) } }
      CVPixelBufferUnlockBaseAddress(mask, .readOnly)
      let bg = CIImage(color: fundo).cropped(to: src.extent)
      let comp = src.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: bg, kCIInputMaskImageKey: m])
      // enquadra com margem em 4:3
      let ow = Double(maxX-minX), oh = Double(maxY-minY)
      var cw = ow*1.18, ch = oh*1.18
      if cw/ch < 4.0/3 { cw = ch*4/3 } else { ch = cw*3/4 }
      let cx = Double(minX)+ow/2, cy = Double(H-maxY)+oh/2
      let canvas = CIImage(color: fundo).cropped(to: CGRect(x: cx-cw/2, y: cy-ch/2, width: cw, height: ch))
      let final = comp.composited(over: canvas).cropped(to: canvas.extent)
      img = ctx.createCGImage(final, from: final.extent)!
    } else { print("sem objeto: \(c[0])") }
  }
  salvar(img, a[3] + "/" + c[0] + ".jpg"); print("ok \(c[0]) \(img.width)x\(img.height)")
}
