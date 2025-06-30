#include <pjsr/ColorSpace.jsh>
function Reticle()
{
    this.__base__ = Object;
    this.__base__(  );

    this.imageWindow = null;
    this.view = null;
    this.image = null;
    
    this.draw = function(win, radius = 20) {
	console.writeln("radius :" + radius);
	if (win &&!win.isNull) {
	    let view = win.mainView;
	    if (view && view.image) {
		let image = view.image;
		let bmap = image.render();
		let pen = new Pen(0xff008888, 1);
		let graphics = new VectorGraphics(bmap);
		let w = image.width, h = image.height,
		    midX = w/2, midY = h/2;
		try {
		    graphics.pen = pen;
		    graphics.drawLine(0, midY, w, midY);
		    graphics.drawLine(midX, 0, midX, h);
		    graphics.drawArc(midX, midY, radius, 0, 6.28);
		} finally {
		    graphics.end();
		}
		// view.beginProcess(UndoFlag_NoSwapFile);
		// image.blend(bmap);
		// view.endProcess();
		return bmap;
	    }
	}
    }
    return null;
};

Reticle.prototype = new Object();

//test
function test()  {
    var path = "/Volumes/G12T/Astro/starfront/SCA260/Capture/Owl Nebula/2025-05-18/Poseidon-M PRO/SCA260/2025-05-18/OIII/LIGHT_OIII_180.00s_1x1bin_deg_GAIN_125_OFFSET_20_-5.00C_0007.fits"
    var imageWindow =ImageWindow.open(path, "Preview"+Date.now(), "", true)[0];
    imageWindow.mainView.beginProcess();
    imageWindow.mainView.image.colorSpace = ColorSpace_RGB;
    imageWindow.mainView.endProcess();
    reticle = new Reticle();
		
    reticle.draw(imageWindow);
}
#ifdef TEST_RETICLE
test();
#endif
