#include <pjsr/NumericControl.jsh>
#include <pjsr/BRQuadTree.jsh>
#include <pjsr/ColorComboBox.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/FontFamily.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/ImageOp.jsh>
#include <pjsr/KeyCodes.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/SimpleColorDialog.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/UndoFlag.jsh>
#include "PreviewWindow.js"    
#include "ProgressBar.js"    
#include <pjsr/ResizeMode.jsh>
#include "AutoStretch.js"

function main() {
    console.show(); 
    var previewWindow = new PreviewWindow(new Frame);
    var imageWindows = new Array()
    var testImageDir = "/Volumes/Astro/Starfront/CSRC8/Capture/Helix Nebula" +
	"/2025-06-24/bin_1x1/ZWO ASI2600MM Pro/CS8RC/2025-06-24/Ha";
    let gdd = GetDirectoryDialog();
    gdd.directory = testImageDir;
    console.writeln("passing path " + testImageDir);
    if (gdd.execute() != StdButton_Ok)
	return;
    let dir = gdd.directory;
    if ( ! dir.endsWith('/') )
	dir += '/';
    let fileList = searchDirectory(dir, false);
    fileList = fileList.filter( (f) => File.extractExtension() == "xisf" || File.extractExtension() == "fits");
    console.writeln("got fileList = " + fileList);
//    previewWindow.SetImage(path);
    imgWindow.forceClose();
}
main();
