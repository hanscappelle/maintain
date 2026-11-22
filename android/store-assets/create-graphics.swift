import AppKit

let directory = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")

func color(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255,
            green: CGFloat((hex >> 8) & 255) / 255,
            blue: CGFloat(hex & 255) / 255, alpha: 1)
}

func rect(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat, _ fill: UInt32, radius: CGFloat = 0) {
    color(fill).setFill()
    NSBezierPath(roundedRect: NSRect(x: x, y: y, width: width, height: height),
                 xRadius: radius, yRadius: radius).fill()
}

func text(_ value: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ fill: UInt32, weight: NSFont.Weight = .regular) {
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color(fill)
    ]
    (value as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: attributes)
}

func logo(_ x: CGFloat, _ y: CGFloat, _ size: CGFloat) {
    let scale = size / 108
    func circle(_ cx: CGFloat, _ cy: CGFloat, _ radius: CGFloat, _ fill: UInt32) {
        color(fill).setFill()
        NSBezierPath(ovalIn: NSRect(x: x + (cx - radius) * scale, y: y + (cy - radius) * scale,
                                   width: radius * 2 * scale, height: radius * 2 * scale)).fill()
    }
    circle(51, 55, 34, 0xFFFFFF)
    circle(51, 55, 17, 0x294B39)
    rect(x + 62 * scale, y + 57 * scale, 26 * scale, 12 * scale, 0x294B39)
    rect(x + 48 * scale, y + 51 * scale, 31 * scale, 8 * scale, 0xFFFFFF)
    circle(78, 38, 4, 0xC7E58D)
}

func save(_ name: String, width: Int, height: Int, draw: () -> Void) throws {
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                                        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                        isPlanar: false, colorSpaceName: .deviceRGB,
                                        bytesPerRow: 0, bitsPerPixel: 0),
          let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        throw NSError(domain: "StoreGraphics", code: 1)
    }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    draw()
    NSGraphicsContext.restoreGraphicsState()
    let format: NSBitmapImageRep.FileType = name.hasSuffix(".jpg") ? .jpeg : .png
    guard let data = bitmap.representation(using: format, properties: [.compressionFactor: 0.95]) else {
        throw NSError(domain: "StoreGraphics", code: 1)
    }
    try data.write(to: directory.appendingPathComponent(name))
}

try save("icon.png", width: 512, height: 512) {
    rect(0, 0, 512, 512, 0x294B39)
    logo(51, 51, 410)
}

try save("feature-graphic.jpg", width: 1024, height: 500) {
    rect(0, 0, 1024, 500, 0xF6F7F2)
    rect(0, 0, 18, 500, 0xC7E58D)
    rect(68, 362, 70, 70, 0x294B39, radius: 18)
    logo(75, 369, 56)
    text("garageboek", 154, 373, 39, 0x294B39, weight: .bold)
    text("Your vehicles.", 68, 245, 58, 0x1D3027, weight: .bold)
    text("Their story.", 68, 177, 58, 0x1D3027, weight: .bold)
    text("Maintenance, mileage and notes in one place.", 70, 115, 21, 0x52685A)
    rect(700, 71, 251, 358, 0x294B39, radius: 28)
    text("YOUR GARAGE", 728, 370, 14, 0xC7E58D, weight: .bold)
    text("At a glance", 728, 330, 25, 0xFFFFFF, weight: .bold)
    rect(725, 226, 201, 84, 0x3D6F53, radius: 12)
    text("Honda CB500", 741, 277, 17, 0xFFFFFF, weight: .semibold)
    text("29,400 km", 741, 245, 22, 0xFFFFFF, weight: .bold)
    rect(725, 120, 201, 84, 0xF6F7F2, radius: 12)
    text("NEXT UP", 741, 176, 12, 0x3D6F53, weight: .bold)
    text("Check chain", 741, 145, 19, 0x294B39, weight: .semibold)
}
