/*
 * Preview Control
 *
 * This file is part of the AnnotateImage script
 *
 * Copyright (C) 2013-2024, Andres del Pozo
 * Copyright (C) 2019-2024, Juan Conejero (PTeam)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

#include <pjsr/BitmapInterpolation.jsh>
#include <pjsr/ButtonCodes.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/ImageOp.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/ResizeMode.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/UndoFlag.jsh>
#include "AutoStretch.js"
#include "Reticle.js"

function Cache() {
    this.__base__ = Object;
    this.__base__();

    this.cache = {};

    this.get = (path) => {
	return this.cache[path] || null;
    }

    this.set = (path, obj) => {
	this.cache[path] =  obj;
    }

    this.clear = () => {
	this.cache = {};
    }
};

function PreviewWindow( parent )
{
    this.__base__ = Frame;
    this.__base__( parent );
    this.parent = parent;
    const CULL_W = 600;
    const CULL_H = 400;
    const PreviewSize = this.logicalPixelsToPhysical(202); // from Blink.cpp
    this.image = null;
    this.stretchedImage = null;
    var self = this;
    this.imageWindow = null;
    this.cullWindow = new ImageWindow(CULL_W, CULL_H, 3, 32, true, true, "CullPreview");
//    this.cullWindow.show();
    this.hide(); //add controls later
    this.reticle = new Reticle();
    this.cache = new Cache();

    this.bitmapScale = function(image) {
	let w = (image.width > image.height) ? PreviewSize :
	    Math.round( PreviewSize *image.width()/image.height );
	let h = (image.height > image.width) ? PreviewSize :
	    Math.round( PreviewSize *image.height/image.width );
	return {w:w, h:h};
    };

    this.SetImage = function( path )
    {
	console.noteln("SetImage passed path " + path);
	if (this.imageWindow && !this.imageWindow.isNull) {
	    this.imageWindow.forceClose();
	}
	let bmp = this.cache.get(path);
	if (bmp !== null) {
	    console.noteln("SetImage : cache hit");
	    this.showImageFromCache(bmp);
	} else {
	    console.noteln("SetImage : cache miss");
	    var window = ImageWindow.open(path)[0];
            if (window && window.isValidView && !window.isNull) {
		this.imageWindow = window;
		this.view = window.mainView;
		this.image = window.mainView.image;
		this.showImage(window);
		let scale = this.bitmapScale(this.image);
		this.cache.set(path,
			       this.cullWindow.mainView.image.render());			      //       this.cullWindow.mainView.image.render().scaledTo(scale.w/2, scale.h/2));
	    }
	}
   };

    this.closeWindow = function () {
	console.writeln("Closing cull window " + this.cullWindow);
	if (this.cullWindow && !this.cullWindow.isNull) {
	    this.cullWindow.forceClose();
	}
	console.writeln("Closing image window " + this.imageWindow);
	if (this.imageWindow && !this.imageWindow.isNull) {
	    this.imageWindow.forceClose();
	}
    };
    
    this.showImageFromCache = function(bmap) {
	this.cullWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
	this.cullWindow.mainView.image.blend(bmap);
	this.cullWindow.mainView.endProcess();
	this.cullWindow.updateViewport();
    };
	
    this.showImage = function(window) {
	console.noteln("showImage got arg " + window);
	try {
	    if (window != null && ! window.isNull) {
		let view = window.mainView;
		let image = view.image
		console.noteln("window, view, image: " + window+ " " + view + " " + image);
		if ( image ) {
		    view.beginProcess(UndoFlag_NoSwapFile);
		    image.colorSpace = ColorSpace_RGB;
		    image.resample(CULL_W, CULL_H, ResizeMode_AbsolutePixels, AbsoluteResizeMode_ForceWidth);
		    view.endProcess();
		    let autoStretch = new AutoStretch;
		    try {
			autoStretch.HardApply(view, false); //true, -2.80, 0.25);
			let bmap = this.reticle.draw(window, image.width/25);
			console.noteln(format("bmap dimensions %d w and %d h", bmap.width, bmap.height));
			this.cullWindow.mainView.image.resetSelections();
			this.cullWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
			this.cullWindow.mainView.image.selectedChannel = 0;
			this.cullWindow.mainView.image.blend(bmap);
		    } catch (ex) {
			console.writeln(ex.stack);
			//		    console.writeln("Fatal error " + ex );
			throw(ex);
		    } finally {
			this.cullWindow.mainView.endProcess();	
		    }

		    let  p = this.parent.window.position;
		    let cp = new Point;
		    cp.x = p.x - this.cullWindow.width -5;
		    cp.y = p.y;
		    this.cullWindow.position = cp;
		    this.cullWindow.show();

		    self.cullWindow.zoomToOptimalFit();
		    this.cullWindow.updateViewport();
		}
	    } 
	} catch (exc) {
	    console.writeln("exception drawing PreviewWindow: " + exc);
	} finally {

	}

    };

    this.computeImageBitmap = (window) => {
	if ( window.mainView.image ) {
	    let view = window.mainView
	    let image = view.image;
	    let origbmap = image.render();
	    view.beginProcess(UndoFlag_NoSwapFile);
	    image.colorSpace = ColorSpace_RGB;
	    let scale = this.bitmapScale(image);
	    
	    image.resample(CULL_W, CULL_H, ResizeMode_AbsolutePixels, AbsoluteResizeMode_ForceWidth);
	    // origbmap.scaledTo(scale.w, scale.h);
	    // image.blend(origbmap);

	    let autoStretch = new AutoStretch;
	    try {
		autoStretch.HardApply(view, false); //true, -2.80, 0.25);
	    } catch (ex) {
		console.writeln(ex.stack);
		//		    console.writeln("Fatal error " + ex );
		throw(ex);
	    } finally {

	    }
	    let bmap = this.reticle.draw(window, image.width/25);

	    image.blend(bmap);
	    view.endProcess();

	    return bmap;
	}
    };

    this.cancelPreCompute = false;
    this.preComputeCache = (filePaths, callback) => {
	if (!filePaths || filePaths.length < 1) {
	    return;
	}
	// Console Progress
	let total = filePaths.length;
	console.abortEnabled = true;
	console.show();

	for (let i = 0; i < filePaths.length; i++) {
	    if (this.cancelPreCompute == true) {
		this.cancelPreCompute = false;
		break;
	    }
	    let path = filePaths[i];
	    if (this.cache.get(path) == null) {
		try {
		    let window = ImageWindow.open(path)[0];
		    let view = window.mainView;
		    this.cache.set(path, this.computeImageBitmap(window));
		    callback(i, filePaths.length);
		    window.forceClose();
		} catch (exc) {
		    console.criticalln(exc);
		}
	    }
	}
    };

}

PreviewWindow.prototype = new Frame;
