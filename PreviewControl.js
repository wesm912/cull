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
#include <pjsr/SampleType.jsh>
#include <pjsr/ResizeMode.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/UndoFlag.jsh>
#include "AutoStretch.js"

function PreviewControl( parent )
{
   this.__base__ = Frame;
    this.__base__( parent );
    this.image = null;
    this.stretchedImage = null;
    var self = this;
    var dlg = this.parent;
    this.imageWindow = null;
    this.scrollbox = new ScrollBox(this);
    this.scrollbox.autoScroll = false;
    this.scrollbox.scrollBarsVisible = false;
    this.scrollboxSizer = new VerticalSizer;
    this.scrollboxSizer.add(this.scrollbox);
    this.scrollbox.resize(750,500);
//    this.scrollboxSizer.setAlignment(this.scrollbox, Align_Center);
    
   this.SetImage = function( window )
    {
	if (this.imageWindow && !this.imageWindow.isNull) {
	    this.imageWindow.forceClose();
	}
	this.imageWindow = window;
	this.view = window.mainView;
	this.image = self.view.image;
	this.scrollbox.viewport.update();
   };
   
   this.scrollbox.viewport.onPaint = function( x0, y0, x1, y1 )
    {
	console.writeln("passed arguments " + x0 + ", " +y0 +  ", " + x1 + "," + y1);
	
	//	var preview = window.createPreview(x0,y0,x1,y1,"Preview-" + Date.now());
	try {
	    if (self.imageWindow != null && ! self.imageWindow.isNull) {
//		self.imageWindow.show();
		var view = self.imageWindow.mainView;
		var image = self.view.image;
		let tmpImage = new Image(image);
		var midX = (x1-x0)/2;
		var midY = (y1-y0)/2;
//		view.image = tmpImage;

		let resampler = new Resample();
		resampler.mode = ResizeMode_AbsolutePixels
		resampler.xSize = x1 -x0;
		resampler.ySize = y1 - y0;
		view.beginProcess( UndoFlag_NoSwapFile);
		resampler.executeOn(view);
		view.endProcess();

		if ( image ) {
		    let autoStretch = new AutoStretch;
		    try {
			autoStretch.HardApply(view, false); //true, -2.80, 0.25);
		    } catch (ex) {
			console.writeln(ex.stack);
			//		    console.writeln("Fatal error " + ex );
			throw(ex);
		    }
		}
		
		let graphics = new VectorGraphics( this );
		graphics.fillRect( x0, y0, x1, y1, new Brush( 0x202aa55c ) );
		if (image) {
		    let bitmap = new Bitmap(x1 -x0, y1 - y0);
		    let pi = 3.14159;
		    bitmap.assign(tmpImage.render());
		    graphics.drawBitmap( 0, 0, bitmap);
		    // Draw reticle
		    graphics.brush = new Brush(0xff000000);
		    graphics.drawLine(midX, y0, midX, y1);
		    graphics.drawLine(x0, midY, x1, midY);
		    graphics.drawArc(midX, midY, (x1-x0)/25, 0, 2*pi);
		    
		}
		graphics.end();
	    } 
	} catch (exc) {
	    console.writeln("exception drawing PreviewControl: " + exc);
	} finally {

	}

   };

}

PreviewControl.prototype = new Frame;
