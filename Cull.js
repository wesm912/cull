/*
 * Advanced Blink Replacement Script for PixInsight
 * A comprehensive file management and preview tool for astronomical images
 */

#feature-id    Utilities > Advanced Blink Replacement

#define TITLE "Advanced Blink Replacement"
#define VERSION "1.0"
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

// Global variables
//var dialog;
var fileList = [];
var currentIndex = 0;
var previewBitmap = null;
var playTimer = null;
var isPlaying = false;
var stretchMode = 0; // 0: Linear, 1: STF, 2: Histogram
var shadowsClipping = 0.0;
var highlightsClipping = 1.0;
var midtonesBalance = 0.5;

// File management class
function FileManager() {
    this.inputDirectory = "";
    this.keepDirectory = "";
    this.rejectDirectory = "";

      var files = [];
      var extensions = [".fits", ".xisf", ".fit", ".fts"];

      this.findFiles = function(directory ) {
         let base = File.fullPath(directory);
         if (base[base.length -1] == "/")
            if (base != "/")
               base.slice(base.length -1, -1);
         for (let i = 0; i < extensions.length; i++) {
            let found = searchDirectory(base + "/*" + extensions[i], true);
            for (let j = 0; j < found.length; j++) {
               let tmp = found[j];
               let slash = tmp.lastIndexOf('/');
               if (slash > 0) {
                  tmp.slice(slash);
               }
               files.push({
                  path: found[j],
                  name: tmp,
                  keep: false,
                   reject: false,
		   reference: false
               })
            }
         };
      fileList = files;
      return files;
    };

    this.moveFiles = function(files, targetDirectory, type) {
        var moved = 0;
        for (var i = 0; i < files.length; i++) {
            if ((type === "keep" && files[i].keep) || (type === "reject" && files[i].reject)) {
                try {
                    var targetPath = targetDirectory + "/" + files[i].name;
                    File.move(files[i].path, targetPath);
                    moved++;
                } catch (error) {
                    console.writeln("Error moving file " + files[i].name + ": " + error.message);
                }
            }
        }
        return moved;
    };
}

// Image preview class
//function ImagePreview() {
//    this.loadImage = function(filePath) {
//        try {
//                 return window;
//             }
//         } catch (error) {
//             console.writeln("Error loading image: " + error.message);
//         }
//         return null;
//     };

//     this.createBitmap = function(window, width, height) {
//         if (!window || !window.isValidView) return null;

//         try {
//             var view = window.mainView;
//             var image = view.image;

//             // Apply stretching based on current mode
//             var stretchedImage = new Image(image);
//             this.applyStretch(stretchedImage);

//             // Create bitmap
//  //           var bitmap = new Bitmap(width, height);
//  //           bitmap.assign(stretchedImage);
//             console.writeln("Creating bitmap");
//             return stretchedImage.render();
//         } catch (error) {
//             console.writeln("Error creating bitmap: " + error.message);
//             return null;
//         }
//     };

// }

// Main dialog class
function CullDialog() {
    this.__base__ = Dialog;
    this.__base__();

    var fileManager = new FileManager();
    var imagePreview = new ImagePreview();
    this.previewWindow = new PreviewWindow(this)
    var self = this;
    this.focusStyle = 0x02;//keypress events
    // UI Controls
    this.filesTreeBox = new TreeBox(this);
    this.filesTreeBox.setMinSize(400, 300);
    this.filesTreeBox.numberOfColumns = 2;
    this.filesTreeBox.headerVisible = true;
    this.filesTreeBox.setHeaderText(0,  "✓ / ✗");
    this.filesTreeBox.adjustColumnWidthToContents(0);
    this.filesTreeBox.setHeaderText(1, "Filename");
    this.filesTreeBox.alternateRowColor = true;

    // Preview Dialog

    // Directory controls
    this.inputDirEdit = new Edit(this);
    this.inputDirButton = new PushButton(this);
    this.inputDirButton.text = "Load Files...";

    this.keepDirEdit = new Edit(this);
    this.keepDirButton = new PushButton(this);
    this.keepDirButton.text = "Keep...";

    this.rejectDirEdit = new Edit(this);
    this.rejectDirButton = new PushButton(this);
    this.rejectDirButton.text = "Reject...";

    // File operation controls
    this.moveKeepButton = new PushButton(this);
//    this.moveKeepButton.text = "Move Keep Files";
    this.moveKeepButton.icon = this.scaledResource(":/icons/save.png");
    this.moveKeepButton.backgroundColor = 0xFF00ee00;

    this.moveRejectButton = new PushButton(this);
//    this.moveRejectButton.text = "Move Reject Files";
    this.moveRejectButton.icon = this.scaledResource(":/file-explorer/cut.png");
    this.moveRejectButton.backgroundColor = 0xFFee0000;
    this.moveRejectButton.toolTip = "Move files marked to save to rejects directory."

    // Playback controls
    this.prevButton = new PushButton(this);
    //    this.prevButton.text = "◀";
    this.prevButton.icon = this.scaledResource(":/icons/goto-previous.png");
    this.prevButton.setFixedSize(30, 25);

    this.playButton = new PushButton(this);
    this.playButton.icon = this.scaledResource(":/icons/play.png");
//    this.playButton.text = "▶";
    this.playButton.setFixedSize(30, 25);

    this.nextButton = new PushButton(this);
    this.nextButton.icon = this.scaledResource(":/icons/goto-next.png");
//    this.nextButton.text = "▶";
    this.nextButton.setFixedSize(30, 25);

    this.speedComboBox = new ComboBox(this);
    this.speedComboBox.addItem("0.1 sec");
    this.speedComboBox.addItem("0.3 sec");
    this.speedComboBox.addItem("0.5 sec");
    this.speedComboBox.addItem("1.0 sec");
    this.speedComboBox.addItem("1.5 sec");
    this.speedComboBox.addItem("2.0 sec");
    this.speedComboBox.currentItem = 2;

    // // Stretch controls
    // this.stretchLabel = new Label(this);
    // this.stretchLabel.text = "Stretch Mode:";

    // this.stretchComboBox = new ComboBox(this);
    // this.stretchComboBox.addItem("Linear");
    // this.stretchComboBox.addItem("STF");
    // this.stretchComboBox.addItem("Histogram");
    // this.stretchComboBox.currentItem = 0;

    // this.shadowsSlider = new NumericControl(this);
    // this.shadowsSlider.label.text = "Shadows:";
   // this.shadowsSlider.setRange(0, 1);
    // this.shadowsSlider.setValue(0);
    // this.shadowsSlider.setPrecision(3);

    // this.highlightsSlider = new NumericControl(this);
    // this.highlightsSlider.label.text = "Highlights:";
    // this.highlightsSlider.setRange(0, 1);
    // this.highlightsSlider.setValue(1);
    // this.highlightsSlider.setPrecision(3);

    // this.midtonesSlider = new NumericControl(this);
    // this.midtonesSlider.label.text = "Midtones:";
    // this.midtonesSlider.setRange(0, 1);
    // this.midtonesSlider.setValue(0.5);
    // this.midtonesSlider.setPrecision(3);

   this.ok_Button = new PushButton( this );
   this.ok_Button.defaultButton = true;
   this.ok_Button.text = "Close";
   this.ok_Button.icon = this.scaledResource( ":/icons/close.png" );
   this.ok_Button.onClick = function()
   {
       this.dialog.ok();
       self.previewWindow.closeWindow();
   };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.addStretch();
    this.buttons_Sizer.add( this.ok_Button, 50, Align_Center );

    // Event handlers
    var self = this;

    this.inputDirButton.onClick = function() {
        var dialog = new GetDirectoryDialog();
        if (dialog.execute()) {
            self.inputDirEdit.text = dialog.directory;
            fileManager.inputDirectory = dialog.directory;
            fileList = fileManager.findFiles(fileManager.inputDirectory, true);
            self.updateFileList();
            if (fileList.length > 0) {
                currentIndex = 0;
                self.selectFile(0);
            }
        }
    };

    this.keepDirButton.onClick = function() {
        var dialog = new GetDirectoryDialog();
        if (dialog.execute()) {
            self.keepDirEdit.text = dialog.directory;
            fileManager.keepDirectory = dialog.directory;
        }
    };

    this.rejectDirButton.onClick = function() {
        var dialog = new GetDirectoryDialog();
        if (dialog.execute()) {
            self.rejectDirEdit.text = dialog.directory;
            fileManager.rejectDirectory = dialog.directory;
        }
    };


    this.moveKeepButton.onClick = function() {
        if (fileManager.keepDirectory) {
            var moved = fileManager.moveFiles(fileList, fileManager.keepDirectory, "keep");
            console.writeln("Moved " + moved + " files to keep directory");
            // Remove moved files from list
            fileList = fileList.filter(function(file) { return !file.keep; });
            self.updateFileList();
        } else {
	    let msg = new MessageBox("Please choose a directory to hold files to keep");
	    msg.execute();
	}
    };

    this.moveRejectButton.onClick = function() {
        if (fileManager.rejectDirectory) {
            var moved = fileManager.moveFiles(fileList, fileManager.rejectDirectory, "reject");
            console.writeln("Moved " + moved + " files to reject directory");
            // Remove moved files from list
            fileList = fileList.filter(function(file) { return !file.reject; });
            self.updateFileList();
        } else {
	    let msg = new MessageBox("Please choose a directory to hold files to remove");
	    msg.execute();
	}
    };

    this.prevButton.onClick = function() {
        if (currentIndex > 0) {
            currentIndex--;
        } else {
	    currentIndex = fileList.length -1;
	}
        self.selectFile(currentIndex);
    };

    this.nextButton.onClick = function() {
        if (currentIndex < fileList.length - 1) {
            currentIndex++;
        } else {
	    currentIndex= 0;
	}
        self.selectFile(currentIndex);
    };

    this.playButton.onClick = function() {
        if (isPlaying) {
            self.pausePlayback();
        } else {
            self.startPlayback();
        }
    };

    // this.stretchComboBox.onItemSelected = function(item) {
    //     stretchMode = item;
    //     self.updatePreview();
    // };

    // this.shadowsSlider.onValueUpdated = function(value) {
    //     shadowsClipping = value;
    //     self.updatePreview();
    // };

    // this.highlightsSlider.onValueUpdated = function(value) {
    //     highlightsClipping = value;
    //     self.updatePreview();
    // };

    // this.midtonesSlider.onValueUpdated = function(value) {
    //     midtonesBalance = value;
    //     self.updatePreview();
    // };

    this.filesTreeBox.onNodeClicked = function(node, column) {
        currentIndex = self.filesTreeBox.childIndex(node);
        self.selectFile(currentIndex);
    }

    this.filesTreeBox.onNodeSelectionUpdated = function() {
        if (self.filesTreeBox.selectedNodes.length > 0) {
            var node = self.filesTreeBox.selectedNodes[0];
            currentIndex = self.filesTreeBox.childIndex(node);
            self.updatePreview();
        }
    };

    this.filesTreeBox.onKeyPress = function() {
	return false;
    };
    
    // Keyboard handling
    this.onKeyPress = function(key, modifiers) {
	let wantsKey = false;
	console.writeln("Got key " + key + ", modifiers " + modifiers);
        switch (key) {
        case Key_Up:
            if (currentIndex > 0) {
                currentIndex--;
            } else {
		currentIndex = fileList.length -1;
	    }
            self.selectFile(currentIndex);
	    wantsKey = true;
            break;
        case Key_Down:
            if (currentIndex < fileList.length - 1) {
                currentIndex++;
            } else {
		currentIndex = 0;
	    }
            self.selectFile(currentIndex);
	    wantsKey = true;
            break;
        case Key_K: // 'K' key
	    console.writeln("keypress K");
            if (fileList.length > 0) {
                fileList[currentIndex].keep = !fileList[currentIndex].keep;
                fileList[currentIndex].reject = false;
//		self.filesTreeBox.currentnode.selected = true;

                self.updateFileList();
            }
	    wantsKey = true;
            break;
        case Key_X: // 'X' key
	    console.writeln("keypress X");
            if (fileList.length > 0) {
                fileList[currentIndex].reject = !fileList[currentIndex].reject;
                fileList[currentIndex].keep = false;
                self.updateFileList();
            }
	    wantsKey = true;
            break;
	default:
	    console.writeln("got keycode " + key);
	    break;
        }
	return wantsKey;
    };

    // Helper methods
    this.updateFileList = function() {
        self.filesTreeBox.clear();
        for (var i = 0; i < fileList.length; i++) {
            var node = new TreeBoxNode(self.filesTreeBox);
	    if (fileList[i].keep) {
		//		node.setText(0, "✓" );
		node.setIcon(0, ":/icons/add.png");
	    } else if (fileList[i].reject) {
		node.setIcon(0,":/icons/delete.png");
	    }
            node.setText(1, fileList[i].name);
        }
	this.selectFile(currentIndex);
    };

    this.selectFile = function(index) {
        if (index >= 0 && index < fileList.length) {
	    let currentNode = self.filesTreeBox.currentNode;
	    if (currentNode) {
		currentNode.selected = false;
	    }
            currentIndex = index;
	    console.writeln("Setting current node to " + index);
            self.filesTreeBox.currentNode = self.filesTreeBox.child(index);
	    self.filesTreeBox.currentNode.selected = true;
            self.updatePreview();
        }
    };

    this.updatePreview = function() {
        if (fileList.length > 0 && currentIndex < fileList.length) {
	    //            var window = imagePreview.loadImage(fileList[currentIndex].path);
	    console.writeln("Calling previewWindow.SetImage");
	    this.previewWindow.SetImage(fileList[currentIndex].path);
            // if (window) {
	    // 	previewControl.SetImage(window);
            // }
        }
    };

    this.startPlayback = function() {
	if (fileList.length == 0)
	    return;
        isPlaying = true;
        self.playButton.icon = self.scaledResource(":/icons/pause.png");
        self.prevButton.enabled = false;
        self.nextButton.enabled = false;

        var speeds = [0.100, .300, .500, 1.000, 1.500, 2.000];
        var interval = speeds[self.speedComboBox.currentItem];

        playTimer = new Timer();
        playTimer.interval = interval;
        playTimer.onTimeout = function() {
            if (currentIndex < fileList.length - 1) {
                currentIndex++;
            } else {
		currentIndex = 0;
            }
            self.selectFile(currentIndex);
        };
        playTimer.start();
    };

    this.pausePlayback = function() {
        isPlaying = false;
//        self.playButton.text = "▶";
        self.playButton.icon = self.scaledResource(":/icons/play.png");
        self.prevButton.enabled = true;
        self.nextButton.enabled = true;

        if (playTimer) {
            playTimer.stop();
        }
    };

    // Layout
    this.directorySizer = new HorizontalSizer;
    this.directorySizer.margin = 6;
    this.directorySizer.spacing = 4;
    this.directorySizer.add(this.inputDirEdit, 100);
    this.directorySizer.add(this.inputDirButton);

    this.keepDirSizer = new HorizontalSizer;
    this.keepDirSizer.margin = 6;
    this.keepDirSizer.spacing = 4;
    this.keepDirSizer.add(this.keepDirEdit, 100);
    this.keepDirSizer.add(this.keepDirButton);

    this.rejectDirSizer = new HorizontalSizer;
    this.rejectDirSizer.margin = 6;
    this.rejectDirSizer.spacing = 4;
    this.rejectDirSizer.add(this.rejectDirEdit, 100);
    this.rejectDirSizer.add(this.rejectDirButton);

    this.moveSizer = new HorizontalSizer;
    this.moveSizer.margin = 6;
    this.moveSizer.spacing = 4;
    this.moveSizer.add(this.moveKeepButton);
    this.moveSizer.add(this.moveRejectButton);
    this.moveSizer.addStretch();

    var label = new Label(this);
    label.text = "Speed: ";
    this.playbackSizer = new HorizontalSizer;
    this.playbackSizer.margin = 6;
    this.playbackSizer.spacing = 4;
    this.playbackSizer.add(this.prevButton);
    this.playbackSizer.add(this.playButton);
    this.playbackSizer.add(this.nextButton);
    this.playbackSizer.addSpacing(10);
    this.playbackSizer.add(label);
    this.playbackSizer.add(this.speedComboBox);
    this.playbackSizer.addStretch();

    // this.stretchControlsSizer = new VerticalSizer;
    // this.stretchControlsSizer.margin = 6;
    // this.stretchControlsSizer.spacing = 4;

    // this.stretchModeSizer = new HorizontalSizer;
    // this.stretchModeSizer.add(this.stretchLabel);
    // this.stretchModeSizer.add(this.stretchComboBox);
    // this.stretchModeSizer.addStretch();

    // this.stretchControlsSizer.add(this.stretchModeSizer);
    // this.stretchControlsSizer.add(this.shadowsSlider);
    // this.stretchControlsSizer.add(this.highlightsSlider);
    // this.stretchControlsSizer.add(this.midtonesSlider);

    this.leftSizer = new VerticalSizer;
    this.leftSizer.margin = 6;
    this.leftSizer.spacing = 4;
    this.leftSizer.add(this.previewWindow, 100);
    this.leftSizer.add(this.playbackSizer);
//    this.leftSizer.add(this.stretchControlsSizer);

    this.rightSizer = new VerticalSizer;
    this.rightSizer.margin = 6;
    this.rightSizer.spacing = 4;
    this.rightSizer.add(this.directorySizer, 100);
    this.rightSizer.add(this.keepDirSizer, 100);
    this.rightSizer.add(this.rejectDirSizer, 100);
    this.rightSizer.add(this.moveSizer, 100);
    this.rightSizer.add(this.filesTreeBox, 100);


    this.mainSizer = new HorizontalSizer;
    this.mainSizer.margin = 6;
    this.mainSizer.spacing = 4;
    this.mainSizer.add(this.leftSizer, 50);
    this.mainSizer.add(this.rightSizer, 50);

    this.sizer = new VerticalSizer;
    this.sizer.add(this.mainSizer, 50);
    this.sizer.add(this.buttons_Sizer, 50);

    // this.controlsSizer = new VerticalSizer;
    // this.controlsSizer.margin = 6;
    // this.controlsSizer.spacing = 4;
    // this.controlsSizer.add(this.directorySizer);
    // this.controlsSizer.add(this.keepDirSizer);
    // this.controlsSizer.add(this.rejectDirSizer);
    // this.controlsSizer.add(this.moveSizer);
    //this.controlsSizer.add(this.mainSizer, 100);

//    this.sizer = this.mainSizer;

    this.windowTitle = TITLE + " v" + VERSION;
    this.minWidth = 800; //>>??
    this.minHeight = 600;
//    this.setMinSize(800, 600);

    // Cleanup on close
    this.onClose = function() {
        if (playTimer) {
            playTimer.stop();
        }
        if (previewBitmap) {
            previewBitmap = null;
        }
	self.previewWindow.closeWindow();
    };
}

// Inherit from Dialog
CullDialog.prototype = new Dialog;

// Main execution
function main() {
    console.show();

    var dialog = new CullDialog();
    console.writeln(" Dialog focus style " + dialog.focusStyle);
    try {

	dialog.execute();
    } catch (ex) {
	console.writeln("Fatal: " + ex);
    }
};

main();
