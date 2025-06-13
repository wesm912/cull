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

function PreviewWindow( )
{
    this.__base__ = Frame;
    this.__base__(  );
    const CULL_W = 750;
    const CULL_H = 500;
    this.image = null;
    this.stretchedImage = null;
    var self = this;
    this.imageWindow = null;
    this.cullWindow = new ImageWindow(CULL_W, CULL_H, 3, 32, true, true, "Cull");
    this.cullWindow.show();
    this.hide(); //add controls later
    this.reticle = new Reticle();
    
   this.SetImage = function( window )
    {
	if (this.imageWindow && !this.imageWindow.isNull) {
	    this.imageWindow.forceClose();
	}
	this.imageWindow = window;
	this.view = window.mainView;
	this.image = self.view.image;
	this.showImage();
   };
   
    this.showImage = function() {
	console.writeln("show");
	try {
	    if (self.imageWindow != null && ! self.imageWindow.isNull) {
		var view = self.imageWindow.mainView;
		var image = self.view.image;
		var midX = (image.width)/2;
		var midY = (image.height)/2;

		if ( image ) {
		    this.view.beginProcess();
		    image.colorSpace = ColorSpace_RGB;
		    image.resample(CULL_W, CULL_H, ResizeMode_AbsolutePixels, AbsoluteResizeMode_ForceWidth);
		    this.view.endProcess();
		    this.cullWindow.mainView.image.resetSelections();
		    this.cullWindow.mainView.beginProcess();
		    this.cullWindow.mainView.image.selectedChannel = 0;
		    this.cullWindow.mainView.image.assign(image);
		    let autoStretch = new AutoStretch;
		    try {
			autoStretch.HardApply(this.cullWindow.mainView, false); //true, -2.80, 0.25);
		    } catch (ex) {
			console.writeln(ex.stack);
			//		    console.writeln("Fatal error " + ex );
			throw(ex);
		    } finally {
			this.cullWindow.mainView.endProcess();	
		    }
		    this.reticle.draw(this.cullWindow, image.width/25);
		    self.cullWindow.zoomToOptimalFit();
		    this.cullWindow.updateViewport();
		}
	    } 
	} catch (exc) {
	    console.writeln("exception drawing PreviewWindow: " + exc);
	} finally {

	}

   };

}

PreviewWindow.prototype = new Frame;
