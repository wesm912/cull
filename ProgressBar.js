// ----------------------------------------------------------------------------
// PixInsight JavaScript Runtime API - PJSR Version 1.0
// ----------------------------------------------------------------------------
// benchmark.js - Released 2025-04-02T16:50:59Z
// ----------------------------------------------------------------------------
//
// This file is part of PixInsight Benchmark Script version 1.05
//
// Copyright (c) 2014-2025 Pleiades Astrophoto S.L. All Rights Reserved.
// Written by Juan Conejero, PTeam.
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// 3. Neither the names "PixInsight" and "Pleiades Astrophoto", nor the names
//    of their contributors, may be used to endorse or promote products derived
//    from this software without specific prior written permission. For written
//    permission, please contact info@pixinsight.com.
//
// 4. All products derived from this software, in any form whatsoever, must
//    reproduce the following acknowledgment in the end-user documentation
//    and/or other materials provided with the product:
//
//    "This product is based on software from the PixInsight project, developed
//    by Pleiades Astrophoto and its contributors (https://pixinsight.com/)."
//
//    Alternatively, if that is where third-party acknowledgments normally
//    appear, this acknowledgment must be reproduced in the product itself.
//
// THIS SOFTWARE IS PROVIDED BY PLEIADES ASTROPHOTO AND ITS CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
// TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL PLEIADES ASTROPHOTO OR ITS
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, BUSINESS
// INTERRUPTION; PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; AND LOSS OF USE,
// DATA OR PROFITS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
// ----------------------------------------------------------------------------


// ----------------------------------------------------------------------------
#include <pjsr/CryptographicHash.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdDialogCode.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/TextAlign.jsh>


function MyProgressBar( parent )
{
    this.__base__ = Control;
    if ( parent )
	this.__base__( parent );
    else
	this.__base__();

    this.value = 0;
    this.bounded = true;

    this.setFixedHeight( this.font.tightBoundingRect( "100%" ).height << 1 );

    this.onPaint = function()
    {
	let d = this.logicalPixelsToPhysical( 1 );
	let d2 = d >> 1;
	let G = new Graphics( this );
	G.transparentBackground = true;
	G.textAntialiasing = true;
	G.pen = new Pen( 0xff505050, d );
	G.brush = new Brush( 0xff00f0f0 );
	G.drawRect( this.boundsRect.deflatedBy( d2 ) );
	G.brush = new Brush( 0xffffa858 );
	if ( this.bounded )
	{
            G.fillRect( d, d, Math.round( this.value*(this.width-d-d2) ), this.height-d-d2 );
            G.pen = new Pen( 0xff000000 );
            G.drawTextRect( this.boundsRect, format( "%d%%", Math.round( this.value*100 ) ), TextAlign_Center );
	}
	else
	{
            if ( this.value >= this.width )
		this.value = 0;
            G.fillRect( Math.max( d, this.value ), d, Math.min( this.value + (this.width >> 2), this.width-d-d2 ), this.height-d-d2 );
	}
	G.end();
    };
}

MyProgressBar.prototype = new Control;

function ProgressDialog()
{
    this.__base__ = Dialog;
    this.__base__();

    this.canceled = false;

    //

    this.info_Label = new Label( this );

    this.progress = new MyProgressBar( this );
    this.progress.setScaledFixedSize( 400, 20 );

    //

    this.cancel_Button = new PushButton( this );
    this.cancel_Button.text = "Cancel";
    this.cancel_Button.icon = this.scaledResource( ":/icons/cancel.png" );
    this.cancel_Button.onClick = () =>
    {
	this.canceled = true;
	this.timer.stop();
	console.noteln("this.canceled " + this.canceled);
    };

    
    this.startButton = new PushButton(this);
    this.startButton.text = "OK";
    this.startButton.onClick = () =>
    {
	this.ok();
    }
    this.buttons_Sizer = new HorizontalSizer;
    this.buttons_Sizer.addStretch();
    this.buttons_Sizer.add( this.startButton );
    this.buttons_Sizer.add( this.cancel_Button );

    //

    this.sizer = new VerticalSizer;
    this.sizer.margin = 8;
    this.sizer.spacing = 8;
    this.sizer.add( this.info_Label );
    this.sizer.add( this.progress );
    this.sizer.addSpacing( 8 );
    this.sizer.add( this.buttons_Sizer );

//    this.windowTitle = TITLE;
    this.adjustToContents();
    this.setFixedSize();

    this.onHide = ( ) =>
    {
	this.canceled = true;
    };

    this.setRange = function( minimum, maximum )
    {
	if ( maximum === undefined )
	{
            maximum = minimum;
            minimum = 0;
	}
	minimum |= 0;
	maximum |= 0;
	if ( maximum < minimum )
	{
            let t = minimum;
            minimum = maximum;
            maximum = t;
	}
	this.minimum = minimum;
	this.maximum = maximum;
	this.progress.bounded = this.minimum < this.maximum;
	this.setValue( this.minimum );
    };

    this.setText = function( text )
    {
	this.info_Label.text = text;
	processEvents();
    };

    this.setValue = function( value )
    {
	this.value = Math.range( value, this.minimum, this.maximum );
	if ( this.progress.bounded )
            this.progress.value = (this.value - this.minimum)/(this.maximum - this.minimum);
	else
            this.progress.value++;
	this.progress.update();
	processEvents();
    };

    this.increment = function()
    {
	this.setValue( this.value + 1 );
    };

    this.setRange(0);

}

ProgressDialog.prototype = new Dialog;

// function main()
// {
//     let dialog = new ProgressDialog;
//     let timer = new Timer();
//     timer.interval = 1.0;
//     timer.periodic = true;
//     timer.onTimeout = () =>
//     {
// 	dialog.increment();
// 	processEvents();
//     }
//     dialog.LRP = timer.start();
//     dialog.execute();
//     if ( dialog.canceled == true )
//     {
//         if ( (new MessageBox( "Do you really want to exit " + TITLE + "?",
// 			      TITLE, StdIcon_Question, StdButton_No,
// 			      StdButton_Yes )).execute() == StdButton_Yes ) {
// 	    console.show();
// 	    console.noteln("Terminating with Ok");
//         }
//     }
// }


// ----------------------------------------------------------------------------

//main();

// ----------------------------------------------------------------------------
// EOF benchmark.js - Released 2025-04-02T16:50:59Z
