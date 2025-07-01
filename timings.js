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
#include "reticle.js"

function main() {
    console.show(); 
    var previewWindow = new PreviewWindow(new Frame);
    var imageWindows = new Array();
    var images = new Array();
    var bitmaps = new Array();

    let gdd = new GetDirectoryDialog();
    gdd.execute();
    let dir = gdd.directory;
    console.writeln("chose directory " + dir);
    if ( ! dir.endsWith('/') )
	dir += '/';
    let fileList = searchDirectory(dir + "*", true);
    fileList = fileList.filter( (f) => File.extractExtension(f) == ".xisf"
				|| File.extractExtension(f) == ".fits");

    let startT = new ElapsedTime();
    let T = new ElapsedTime()
    fileList.forEach( (file) => {
	let win = null;
	try {
	    win = ImageWindow.open(file)[0];
	} catch (ex) {
	    console.warningln(" Exception thrown for path " + file + ": " + ex);
	} finally {
	    imageWindows.push(win);
	}
    });

    let openAvg = T.value/fileList.length;
    imageWindows = imageWindows.reverse()

    T.reset();
    imageWindows.forEach( (win) => {
	images.push(win.mainView.image);
    });
    let value = T.value;
    let extractAvg = value/fileList.length;

    images = images.reverse();
    T.reset();

    let count = 0;
    images.forEach( (image) => {
	if ( image != null ) {
	    let bmap = image.render();
	} else {
	}
    });

    value = T.value;
    let renderAvg = value/images.length;
    
    count = 0;
    imageWindows.forEach( (win) => {
	if (win != null && !win.isNull){
	    let view = win.mainView, image = view.image;
	    view.beginProcess();
	    image.resample(600, 400, ResizeMode_AbsolutePixels, AbsoluteResizeMode_ForceWidth);
	    view.endProcess();
	    count++;
	}
    });
    
    value = T.value;
    let resampleAvg = value/count;
    
    T.reset();
    count = 0;
    let autoStretch = new AutoStretch();
    imageWindows.forEach( (win) => {
	if (win != null && !win.isNull){
	    let view = win.mainView, image = view.image;
	    try {
		autoStretch.HardApply(view, false);
	    } catch (ex) {
		console.writeln(ex.stack);
	    }
	    count++;
	}
    });
    
    value = T.value;
    let stretchAvg = value/count;

    // Reticle draw
    count = 0;
    T.reset();
    var reticle = new Reticle();
    imageWindows.forEach( (win) => {
	if (win != null && !win.isNull){
	    let bmap = reticle.draw(win);
	    bitmaps.push(bmap);
	    count++;
	}
    });
	
    value = T.value;
    bitmaps = bitmaps.reverse();
    let reticleAvg = value/count;

    // Bitmap blend
    count = 0;
    let bmap = bitmaps[0];
    T.reset();
    imageWindows.forEach ( (win) => {
	if (win != null && !win.isNull){
	    win.mainView.beginProcess();
	    win.mainView.image.blend(bmap);
	    win.mainView.endProcess();
	    count++;
	}
    });
    value = T.value;
    let blendAvg = value/count;
    //Summary
    console.noteln(format("Summary:\nAverage open: %f\nAverage extract %f\n" +
			  "Average render %f\nAverage resample %f\n" +
			  "Average stretch %f\nAverage draw time %f\n" +
			  "Average bitmap blend time %f", openAvg, extractAvg, renderAvg,
			  resampleAvg, stretchAvg, reticleAvg, blendAvg));
		   
    console.noteln(format("Total elapsed time %f for %d files", startT.value, fileList.length));
    imageWindows.forEach( (win) => {
	if (win != null && !win.isNull)
	    win.forceClose();
    });
    
    previewWindow.closeWindow();
}
main();
