/*
 * Advanced Blink Replacement Script for PixInsight
 * A comprehensive file management and preview tool for astronomical images
 */

#feature-id    Utilities > Advanced Blink Replacement

#define TITLE "Cull Images"
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
#include "ProgressBar.js"    

// Global variables
//var dialog;
var fileList = [];
var currentIndex = 0;
var playTimer = null;
var isPlaying = false;
var stretchMode = 0; // 0: Linear, 1: STF, 2: Histogram
var shadowsClipping = 0.0;
var highlightsClipping = 1.0;
var midtonesBalance = 0.5;

// File management class
function FileManager() {
    this.keepDirectory = "";
    this.rejectDirectory = "";

      this.files = [];
      var extensions = [".fits", ".xisf", ".fit", ".fts"];

    this.dirname = function(filePath) {
	let tmp =  filePath;
        let slash = tmp.lastIndexOf('/');
        if (slash > 0) {
            return tmp.slice(0, slash);
        }
	return tmp;
    }

    this.clear = () => {
	this.files = [];
    };
    
    this.findFiles = function(directory, recurse ) {
         let base = File.fullPath(directory);
         if (base[base.length -1] == "/")
            if (base != "/")
               base.slice(base.length -1, -1);
         for (let i = 0; i < extensions.length; i++) {
            let found = searchDirectory(base + "/*" + extensions[i], recurse);
            for (let j = 0; j < found.length; j++) {
               let tmp = found[j];
               let slash = tmp.lastIndexOf('/');
               if (slash > 0) {
                  tmp = tmp.slice(slash + 1);
               }
		this.files.push({
                    path: found[j],
                    name: tmp,
                    keep: false,
                    reject: false,
		    reference: false,
		    moved: false
		})
            }
         };
      fileList = this.files;
      return this.files;
    };

    this.moveFiles = function(files, targetDirectory, type) {
        var moved = 0;
	if (!files || files.length == 0)
	    return 0;
	
	var fileProgressDialog = new ProgressDialog();
	fileProgressDialog.setRange(0, files.length);
	fileProgressDialog.setText(format("Moving %d files to %s", files.length, targetDirectory));
	console.writeln("target directory " + targetDirectory);
	fileProgressDialog.show();
        for (var i = 0; i < files.length; i++) {
	    console.writeln(files[i].path);
            if ((type === "keep" && files[i].keep) || (type === "reject" && files[i].reject)) {
                try {
                    var targetPath = targetDirectory + "/" + files[i].name;
                    File.moveFile(targetPath, files[i].path);
//                    File.copyFile(targetPath, files[i].path);
		    files[i].moved = true;
		    fileProgressDialog.setValue(moved);
                    moved++;
                } catch (error) {
                    console.writeln("Error moving file " + files[i].name + ": " + error.message);
                }
            }
        }
        return moved;
    };

    this.deleteFiles = (files) => {
	
	if (files == null || files.length == 0)
	    return;
	for (let i = 0; i < files.length; i++) {
	    File.remove(files[i].path);
	}
    };
};


// Main dialog class
function CullDialog() {
    this.__base__ = Dialog;
    this.__base__();
    const settingsPrefix = "CULLJS/";
    this.dontNagOnDelete = false;

    var fileManager = new FileManager();
    let noNagOnDelete = Settings.read(settingsPrefix + "noNagOnDelete", DataType_Boolean);
    if (noNagOnDelete != null) this.dontNagOnDelete = noNagOnDelete;

    let keepDir = Settings.read(settingsPrefix + "keepDirectory", DataType_String);
    if (keepDir != null) fileManager.keepDirectory = keepDir.replace(settingsPrefix, "");

    let cullDir = Settings.read(settingsPrefix + "rejectDirectory", DataType_String);
    if (cullDir != null) fileManager.rejectDirectory = cullDir.replace(settingsPrefix,"");

    this.previewWindow = new PreviewWindow(this)
    var self = this;
    this.focusStyle = 0x02;//keypress events


    // UI Controls
    this.filesTreeBox = new TreeBox(this);
    this.filesTreeBox.setMinSize(300, 300);
    this.filesTreeBox.numberOfColumns = 2;
    this.filesTreeBox.headerVisible = true;
    this.filesTreeBox.setHeaderText(0,  "✓ / ✗");
    this.filesTreeBox.adjustColumnWidthToContents(0);
    this.filesTreeBox.setHeaderText(1, "Filename");
    this.filesTreeBox.alternateRowColor = true;
    this.filesTreeBox.multipleSelection = true;


    // Directory controls
    let d = this.logicalPixelsToPhysical( 1 );
    let buttonFixedHeight = 32*d;
    d= buttonFixedHeight;
    this.inputDirButton = new PushButton(this);
    this.inputDirButton.text = "Load Directory...";
    let inputDirBmap = new Bitmap(":/icons/folder-open.png");
    inputDirBmap = inputDirBmap.scaledTo(d>>1);
    this.inputDirButton.icon = inputDirBmap;
    this.inputDirButton.setFixedHeight(buttonFixedHeight);

    //  This.inputDirButton.icon = this.scaledResource(":/icons/folder-open.png")
    this.inputFilesButton = new PushButton(this);
    this.inputFilesButton.text = "Load Files...";
    let inputFilesBmap = new Bitmap(":/icons/file-list.png");
    inputFilesBmap = inputFilesBmap.scaledTo(d>>1);
    this.inputFilesButton.icon = inputFilesBmap;//this.scaledResource(":/icons/file-list.png")
    this.inputFilesButton.setFixedHeight(buttonFixedHeight);

    this.clearSelectionButton = new PushButton(this);
    this.clearSelectionButton.text = "Clear Selection";
    // let clearAllBmap = new Bitmap(":/icons/clear-inverted.png");
    // clearAllBmap = clearAllBmap.scaledTo(d>>1);
    // this.clearAllFilesButton.icon = clearAllBmap;
    this.clearSelectionButton.setFixedHeight(buttonFixedHeight);

    this.clearAllFilesButton = new PushButton(this);
    this.clearAllFilesButton.text = "Clear All";
    let clearAllBmap = new Bitmap(":/icons/clear-inverted.png");
    clearAllBmap = clearAllBmap.scaledTo(d>>1);
    this.clearAllFilesButton.icon = clearAllBmap;
    this.clearAllFilesButton.setFixedHeight(buttonFixedHeight);

    // File operation controls
    this.moveKeepButton = new PushButton(this);
    //    this.moveKeepButton.text = "Move Keep Files";
    this.moveKeepButton.icon = this.scaledResource(":/icons/save.png");
    //    this.moveKeepButton.backgroundColor = 0xFF00ee00;
    this.moveKeepButton.text = "Save files";
    this.moveKeepButton.toolTip = "Move files marked to save to keepers directory."
    this.moveKeepButton.setFixedHeight(buttonFixedHeight);

    this.moveRejectButton = new PushButton(this);
    //    this.moveRejectButton.text = "Move Reject Files";
    this.moveRejectButton.icon = this.scaledResource(":/file-explorer/cut.png");
    //    this.moveRejectButton.backgroundColor = 0xFFee0000;
    this.moveRejectButton.text = "Move rejects"
    this.moveRejectButton.toolTip = "Move files marked to cut to rejects directory."
    this.moveRejectButton.setFixedHeight(buttonFixedHeight);

    // Action keypad buttons
    let dir = fileManager.dirname(#__FILE__);
//    this.actionButtonSizer = new HorizontalSizer;
    
    // this.keepButton = new PushButton(this)
    // this.keepButton.text = "Keep";
    // let keepIcon = new Bitmap(dir + "/icons/icons8-k-key-50.png");
    // keepIcon = keepIcon.scaledTo(d);
    // this.keepButton.icon = keepIcon

    // this.cullButton = new PushButton(this)
    // this.cullButton.text = "Cull";
    // let cullIcon = new Bitmap(dir + "/icons/icons8-x-key-50.png");
    // cullIcon = cullIcon.scaledTo(d);
    // this.cullButton.icon = cullIcon;

    this.settingsButton = new PushButton(this);
    this.settingsButton.text = "Settings ...";
    this.settingsButton.icon = this.scaledResource(":/icons/gear.png");
    this.settingsButton.setFixedHeight(buttonFixedHeight);
    this.settingsButton.onClick = () => {
	this.tabBox.currentPageIndex = 1;
    }


    this.trashButton = new PushButton(this)
    this.trashButton.text = "Really Delete";
    let trashIcon = new Bitmap(dir + "/icons/icons8-remove-50.png");
    trashIcon = trashIcon.scaledTo(d);
    this.trashButton.icon = trashIcon;
    this.trashButton.setFixedHeight(buttonFixedHeight);

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
    this.buttons_Sizer.add( this.ok_Button, 50, Align_Right );

    /*
     *
     * progress bar insertion
     *
     */
    this.progressInfoLabel= new Label(this);
    this.progressInfoLabel.text = "(0/0)";
    this.progressBar = new MyProgressBar(this)
    this.progressBar.setScaledFixedSize( 400, 20 );
    this.progressBar.callback = (count, total) =>
    {
	let pct = 0
	if (total > 0) {
	    pct = (count + 1)/total;
	}
	this.progressBar.value = pct;
	let newLabel = format("(%d/%d)", count + 1, total);
	this.progressInfoLabel.text = newLabel;
	processEvents();
	this.progressBar.update();
	this.progressInfoLabel.update();
	processEvents();
    }

    this.computeBitmapStartButton = new PushButton();
    this.computeBitmapStartButton.text = "Start";
    this.computeBitmapCancelButton = new PushButton();
    this.computeBitmapCancelButton.text = "Cancel";

    this.computeBitmapSizer = new HorizontalSizer();
    this.computeBitmapSizer.margin = 6;
    this.computeBitmapSizer.spacing = 4;
    this.computeBitmapSizer.add(this.progressInfoLabel);
    this.computeBitmapSizer.add(this.progressBar);
    
    this.computeControlsSizer = new HorizontalSizer();
    this.computeControlsSizer.margin = 6;
    this.computeControlsSizer.spacing = 4;
    this.computeControlsSizer.add(this.computeBitmapStartButton, 0, Align_Left);
    this.computeControlsSizer.add(this.computeBitmapCancelButton, 0, Align_Right);

    this.computeSizer = new VerticalSizer(this)
    this.computeSizer.add(this.computeBitmapSizer);
    this.computeSizer.add(this.computeControlsSizer);

    this.computeBitmapGroupBox = new GroupBox(this);
    this.computeBitmapGroupBox.title = "Compute Bitmaps";
    this.computeBitmapGroupBox.sizer = this.computeSizer;
    
    
    // Event handlers
    var self = this;

    this.computeBitmapStartButton.onClick = function () 
    {
	self.previewWindow.preComputeCache(fileList.map( (f) => f.path), self.progressBar.callback);
    }

    this.computeBitmapCancelButton.onClick = () =>
    {
	this.computeBitmapGroupBox.hide();
	this.previewWindow.cancelPreCompute = true;
    }

    this.computeBitmapGroupBox.onShow = () =>
    {
	let msg = new MessageBox("Start the process to pre-compute the bitmap cache",
				 "Build Cache", StdIcon_Question, StdButton_Ok,
				 StdButton_Cancel, 0, 1);
	let ret = msg.execute();
	if ( ret == StdButton_Ok ) {
	    this.computeBitmapStartButton.onClick();
	}
    }
	
    this.inputDirButton.onClick = ( ) => {
        var dialog = new GetDirectoryDialog();
        if (dialog.execute()) {
            fileManager.inputDirectory = dialog.directory;
            fileList = fileManager.findFiles(fileManager.inputDirectory, true);
            this.updateFileList();
            if (fileList.length > 0) {
		if (this.computeBitmapGroupBox.visible) {
		    this.computeBitmapGroupBox.onShow();
		} else {
		    this.computeBitmapGroupBox.show();
		}
                currentIndex = 0;
                this.selectFile(0);
		//		
            }
        }
    };

    this.inputFilesButton.onClick = () =>  {
        var dialog = new OpenFileDialog();
	dialog.multipleSelections = true;
	dialog.filters = [[ "All Supported Formats", "xisf", "fits", "fit"]];
        if (dialog.execute()) {
            let files = dialog.fileNames;
	    for (let i = 0; i < files.length; i++) {
		fileList.push( {
                    path: files[i],
                    name: files[i],
                    keep: false,
                    reject: false,
		    reference: false,
		    moved: false
		})
	    }
	    
            self.updateFileList();
            if (fileList.length > 1) {
		this.computeBitmapGroupBox.show();
                currentIndex = 0;
                this.selectFile(0);
            }
	}
    };

    this.clearSelectionButton.onClick = () => {
	let nodes = this.filesTreeBox.selectedNodes;
	let len = this.filesTreeBox.selectedNodes.length;
	for (let i = 0; i < len; i++) {
	    nodes[i].selected = false;
	}
    };
	    
    this.clearAllFilesButton.onClick = () => {
	fileList = [];
	fileManager.clear();
	this.updateFileList();
	console.noteln("clear all files list length = " + fileList.length);
	this.previewWindow.cache.clear();
    }

    this.validateKeepDirectory = (force = false) => {
        if (!fileManager.keepDirectory || force ) {
	    let msg = new MessageBox("Please choose a directory to hold files to keep",
				     "Choose Directory", StdIcon_NoIcon, StdButton_Ok,
				     StdButton_Cancel, 0, 1);
	    let ret = msg.execute();
	    if (ret != StdButton_Ok) return;
            fileManager.keepDirectory = this.getDirectory("Choose a directory for saved images");
	}
        if (!fileManager.keepDirectory) {
	    return false;  //Canceled
	}
	return true;
    }

    this.validateRejectDirectory = (force = false) => {
        if (!fileManager.rejectDirectory || force ) {
	    let msg = new MessageBox("Please choose a directory to hold files to delete",
				     "Choose Directory", StdIcon_NoIcon, StdButton_Ok,
				     StdButton_Cancel, 0, 1);
	    let ret = msg.execute();
	    if (ret != StdButton_Ok) return;
            fileManager.rejectDirectory = this.getDirectory("Choose a directory for rejected images");
	}
        if (!fileManager.rejectDirectory) {
	    return false;  //Canceled
	}
	return true;
    }

    this.validateDelete = function() {
	if ( this.dontNagOnDelete == false ) {
	    let msg = new MessageBox("Do you really want to delete this file?",
				     "DeleteFile", StdIcon_Question, StdButton_Ok,
				     StdButton_Cancel, 0, 1);
	    if (msg.execute() == StdButton_Ok)
		return true;
	    return false;
	}
	return true;;
    }

    
    this.moveKeepButton.onClick = () => {
	if (this.validateKeepDirectory() == false) return;
	var files = fileList.filter( (f) => f.keep == true);
        var moved = fileManager.moveFiles(files, fileManager.keepDirectory, "keep");
        console.writeln("Moved " + moved + " files to keep directory");
        // Remove moved files from list
        fileList = fileList.filter(function(file) { return !file.moved; });
        self.updateFileList();
    };

    // this.keepButton.onClick = () => {
    // 	if (this.validateKeepDirectory() == false) return;

    // 	let file = fileList[currentIndex];
    // 	file.keep = true;
    // 	console.show();
    // 	console.writeln("Chose file " + file.path + ", " + file.name + ", " + file.keep);
    // 	console.writeln("Keep directory is " + fileManager.keepDirectory);
    // 	fileManager.moveFiles([file], fileManager.keepDirectory, "keep");
    // 	this.updateFileList();
    // }

    this.moveRejectButton.onClick = ( ) => {
	if (this.validateRejectDirectory() == false) return;
	
	var files = fileList.filter( (f) => f.reject == true);
        var moved = fileManager.moveFiles(files, fileManager.rejectDirectory, "reject");
        console.writeln("Moved " + moved + " files to reject directory");
        // Remove moved files from list
        fileList = fileList.filter(function(file) { return !file.reject; });
        self.updateFileList();
    };

    // this.cullButton.onClick = ( ) => {
    // 	if (this.validateRejectDirectory() == false) return;

    // 	let file = fileList[currentIndex];
    // 	file.keep = false;
    // 	file.reject = true;
    // 	console.show();
    // 	console.writeln("Chose file " + file.path + ", " + file.name + ", " + file.keep);
    // 	console.writeln("Rejectdirectory is " + fileManager.rejectDirectory);
    // 	fileManager.moveFiles([file], fileManager.rejectDirectory, "reject");
    // 	this.updateFileList();
    // };

    this.trashButton.onClick = () => {
	if (fileList.length == 0)
	    return;
	if (this.validateDelete() == true) {
	    let nodes = this.filesTreeBox.selectedNodes;
	    let len  = this.filesTreeBox.selectedNodes.length;
	    let fileListFiles = new Array();
	    let idx, fileObj;
	    for (let i = 0; i < len; i++) {
		idx = this.filesTreeBox.childIndex(nodes[i]);
		fileObj = fileList[idx];
		fileObj.moved = true;
		fileObj.keep = false;
		fileObj.reject = true;
		fileListFiles.push(fileList[idx]);
	    }
	    console.noteln("fileList length before delete: " + fileList.length);
	    fileManager.deleteFiles(fileListFiles);
	    this.updateFileList();
	    processEvents();
	    console.noteln("fileList length after delete: " + fileList.length);
	}
    };

    this.nextIndex = (idx) =>
    {
	if (fileList.length < 1)
	    return idx;
	let i = idx;
        if (idx < fileList.length - 1) {
            return idx + 1;
        } else {
	    return 0;
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
	console.warningln("onNodeSelectionUpdated: this is " + this);
        if (self.filesTreeBox.selectedNodes.length > 0) {
	    console.noteln(format("Before selection  %d selected nodes",
				  self.filesTreeBox.selectedNodes.length));
            var node = self.filesTreeBox.selectedNodes[0];
	    console.noteln(format("Before selection updated: currentIndex = %d", currentIndex));
            currentIndex = self.filesTreeBox.childIndex(node);
	    console.noteln(format("After selection updated: currentIndex = %d", currentIndex));
	    //            self.updatePreview();
        }
    };

    this.filesTreeBox.onCurrentNodeUpdated = function() {
	console.warningln("onCurrentNodeUpdated: this is " + this);
	let node = self.filesTreeBox.currentNode;
	console.noteln(format("onCurrentNodeUpdated: currentIndex = %d", currentIndex));
        let idx = self.filesTreeBox.childIndex(node);
	console.noteln(format("onCurrentNodeUpdated: idx = %d", idx));
    };

    // this.filesTreeBox.onKeyPress = function() {
    // 	return false;
    // };
    
    // Keyboard handling

    this.onKeyPress = (key, modifiers) => {
        switch (key) {
        case Key_Up:
            if (currentIndex > 0) {
                currentIndex--;
            } else {
		currentIndex = fileList.length -1;
	    }
            self.selectFile(currentIndex);
	    return true;
            break;
        case Key_Down:
            if (currentIndex < fileList.length - 1) {
                currentIndex++;
            } else {
		currentIndex = 0;
	    }
            self.selectFile(currentIndex);
	    return true;
            break;
        case Key_K: // 'K' key
	    if (self.validateKeepDirectory() == StdButton_Ok) {
		let selectedNodes = self.filesTreeBox.selectedNodes,
		    len = self.filesTreeBox.selectedNodes.length;
		let node, idx, obj;
		for (let i = 0; i < selectedNodes.length; i++) {
		    node = selectedNodes[i];
		    idx = this.filesTreeBox.childIndex(node);
		    obj = fileList[idx];
		    obj.keep = !obj.keep;
		    obj.reject = false;
		    obj.moved = false;
		}
		if (len > 0) {
		    currentIndex = this.nextIndex(idx);
		}
		self.updateFileList();
	    }
            break;
        case Key_X: // 'X' key
	    if (self.validateRejectDirectory() == StdButton_Ok) {
		let selectedNodes = self.filesTreeBox.selectedNodes,
		    len = self.filesTreeBox.selectedNodes.length;
		let node, idx, obj;
		for (let i = 0; i < selectedNodes.length; i++) {
		    node = selectedNodes[i];
		    idx = this.filesTreeBox.childIndex(node);
		    obj = fileList[idx];
		    obj.reject = !obj.reject;
		    obj.keep = false;
		    obj.moved = false;
		}
		if (len > 0) {
		    currentIndex = this.nextIndex(idx);
		}
		self.updateFileList();
	    }
            break;
	case Key_Backspace:
	case Key_Delete:
	    console.noteln("Got backspace or delete key");
	    if (self.validateDelete() == true) {
		console.noteln("Keypress validateDelete returned true");
		let selectedNodes = self.filesTreeBox.selectedNodes;
		let nodesToDelete = [];
		console.noteln( format ("%d nodes to delete", self.filesTreeBox.selectedNodes.length));
		for (let i = 0; i < selectedNodes.length; i++) {
		    node = selectedNodes[i];
		    let idx = this.filesTreeBox.childIndex(node);
		    let obj = fileList[idx];
		    console.warningln(format("Deleting node %s at index %d", obj.name, idx));
		    obj.reject = true;
		    obj.keep = false;
		    obj.moved = true;
		    nodesToDelete.push(obj);
		}
		fileManager.deleteFiles(nodesToDelete);
		self.updateFileList();
	    }
	    break;
	default:
	    console.writeln("got keycode " + key);
	    break;
        }
    };

    this.filesTreeBox.onKeyPress = this.onKeyPress;

    // Helper methods
    this.updateFileList = function() {
	console.noteln(format("Incoming updateFileList fileList.length = %d, currentIndex = %d",
			      fileList.length, currentIndex));
        self.filesTreeBox.clear();
	fileList = fileList.filter( (f) => f.moved === false );

        for (var i = 0; i < fileList.length; i++) {
            var node = new TreeBoxNode(self.filesTreeBox);
	    if (fileList[i].keep) {
		//		node.setText(0, "✓" );
		node.setIcon(0, ":/icons/add.png");
	    } else if (fileList[i].reject) {
		node.setIcon(0,":/icons/delete.png");
	    }
            node.setText(1, fileList[i].name);
	    node.checkable = true;
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
            self.filesTreeBox.currentNode = self.filesTreeBox.child(index);
//	    self.filesTreeBox.currentNode.selected = !self.filesTreeBox.currentNode.selected;
	    self.filesTreeBox.currentNode.selected = true;
            self.updatePreview();
        }
    };

    this.updatePreview = function() {
        if (fileList.length > 0 && currentIndex < fileList.length) {
	    this.previewWindow.SetImage(fileList[currentIndex].path);
        }
    };
    
    this.getDirectory = (caption)=> {
	var dialog = new GetDirectoryDialog();
	dialog.caption = caption;
	if (dialog.execute()) {
            return dialog.directory;
	}
	return null;
    };

    // Playback
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

    var label = new Label(this);
    label.text = "Speed: ";
    this.playbackSizer = new HorizontalSizer;
    this.playbackSizer.margin = 6;
    this.playbackSizer.spacing = 4;
    this.playbackSizer.add(this.prevButton);
    this.playbackSizer.add(this.playButton);
    this.playbackSizer.add(this.nextButton);
    this.playbackSizer.addSpacing(20);
    this.playbackSizer.add(label,0,Align_Center);
    this.playbackSizer.add(this.speedComboBox);
    this.playbackSizer.addStretch();

    /*
      page support
      Page 1 is the culling operations page, so has controls to move checked and move rejected
      items as a group.
      Page 2 is settings page
    */

    // Page 1 -- Culling operations mode
    this.cullButtonsSizer = new VerticalSizer(this);
    this.cullButtonsSizer.margin = 4;
    this.cullButtonsSizer.spacing = 6;
    this.cullButtonsSizer.add(this.inputDirButton);
    this.cullButtonsSizer.add(this.inputFilesButton);
    this.cullButtonsSizer.add(this.clearSelectionButton);
    this.cullButtonsSizer.add(this.clearAllFilesButton);
    this.cullButtonsSizer.add(this.moveKeepButton);
    this.cullButtonsSizer.add(this.moveRejectButton);
    this.cullButtonsSizer.add(this.trashButton);
    this.cullButtonsSizer.add(this.settingsButton); //, 100, Align_Bottom);
    
    this.cullButtonsSizer.addStretch();

    this.cullPageControlsGroupBox = new GroupBox(this);
    this.cullPageControlsGroupBox.sizer = this.cullButtonsSizer;
//    this.bulkPageControlsGroupBox.adjustToContents();
    
    // Hide the action buttons initially
    this.actionButtonSizer = new VerticalSizer();
    this.actionButtonSizer.margin = 4;
    this.actionButtonSizer.spacing = 6;
//    this.actionButtonSizer.add(this.keepButton);
//    this.actionButtonSizer.add(this.cullButton);
//    this.actionButtonSizer.add(this.trashButton);
    this.actionButtonSizer.addStretch();
//    this.actionButtonControl.sizer = this.actionButtonSizer;

    this.settingsPageControlsGroupBox = new GroupBox(this);
//    this.settingsPageControlsGroupBox.sizer = this.actionButtonSizer;
    
    this.cullPage = new Control(this);
    this.cullPage.sizer = new HorizontalSizer(this);
    with (this.cullPage.sizer) {
        margin = 6;
        spacing = 6;
	add(this.filesTreeBox,75);
	add(this.cullPageControlsGroupBox, 25);
    }

    // Choose directory controls
    this.chooseKeepDirectoryButton = new PushButton(this);
    this.chooseKeepDirectoryButton.text = "Keep directory";
    this.chooseKeepDirectoryLabel= new Label(this);
    this.chooseKeepDirectoryLabel.text = "Set up a directory to hold files to keep.<br/>";
    this.chooseKeepDirectoryLabel.text += "Current keep directory is &mdash;" +
	(fileManager.keepDirectory.length > 0  ? fileManager.keepDirectory: " undefined");
    this.chooseKeepDirectorySizer = new HorizontalSizer(this);
    this.chooseKeepDirectorySizer.add(this.chooseKeepDirectoryButton);
    this.chooseKeepDirectorySizer.insertSpacing(1, 50);
    this.chooseKeepDirectorySizer.add(this.chooseKeepDirectoryLabel);
    this.chooseKeepDirectoryLabel.minWidth = 300;
    this.chooseKeepDirectoryLabel.wordWrapping = true;
    this.chooseKeepDirectoryLabel.useRichText = true;
    this.chooseKeepDirectorySizer.addStretch();
    this.chooseKeepDirectoryButton.onClick = () => {
	if (this.validateKeepDirectory(true)) {
	    let text = this.chooseKeepDirectoryLabel.text;
	    text = text.replace(/&mdash(.*)/, fileManager.keepDirectory);
	    this.chooseKeepDirectoryLabel.text = text;
	    processEvents();
	    Settings.write(settingsPrefix + "keepDirectory", DataType_String,
			   fileManager.keepDirectory);
	}
    }

    this.chooseRejectDirectoryButton = new PushButton(this);
    this.chooseRejectDirectoryButton.text = "Cull directory";
    this.chooseRejectDirectoryLabel= new Label(this);
    this.chooseRejectDirectoryLabel.text = "Set up a directory to hold files to cull.<br/>";
    this.chooseRejectDirectoryLabel.text += "Current cull directory is " +
	(fileManager.rejectDirectory.length > 0  ? fileManager.rejectDirectory: "undefined");
    this.chooseRejectDirectorySizer = new HorizontalSizer(this);
    this.chooseRejectDirectorySizer.add(this.chooseRejectDirectoryButton);
    this.chooseRejectDirectorySizer.insertSpacing(1, 50);
    this.chooseRejectDirectorySizer.add(this.chooseRejectDirectoryLabel);
    this.chooseRejectDirectoryLabel.wordWrapping = true;
    this.chooseRejectDirectoryLabel.useRichText = true;
    this.chooseRejectDirectoryLabel.minWidth = 300;
    this.chooseRejectDirectorySizer.addStretch();
    this.chooseRejectDirectoryButton.onClick = () => {
	if(this.validateRejectDirectory(true)) {
	    let text = this.chooseRejectDirectoryLabel.text;
	    text = text.replace(/&mdash(.*)/, fileManager.rejectDirectory);
	    this.chooseRejectDirectoryLabel.text = text;
	    processEvents();
	    Settings.write(settingsPrefix + "rejectDirectory",
			   DataType_String, fileManager.rejectDirectory);
	}
    }

    let buttonWidth = Math.max(this.chooseKeepDirectoryButton.width,
			       this.chooseRejectDirectoryButton.width);
    this.chooseKeepDirectoryButton.minWidth = buttonWidth;
    this.chooseRejectDirectoryButton.minWidth = buttonWidth;
    

    this.directorySettingsSizer = new VerticalSizer(this)
    this.directorySettingsSizer.add(this.chooseKeepDirectorySizer);
    this.directorySettingsSizer.add(this.chooseRejectDirectorySizer);
    this.directorySettingsSizer.margin = 6;
    this.directorySettingsSizer.spacing = 6;
    this.directorySettingsSizer.addStretch();
    
    this.directorySettingsGroupBox = new GroupBox(this);
    this.directorySettingsGroupBox.title = "Directory Settings";
    this.directorySettingsGroupBox.sizer = this.directorySettingsSizer;

    this.dontNagDeleteCheckBox = new CheckBox(this);
    this.dontNagDeleteCheckBox.text = "No prompt on delete?";
    this.dontNagDeleteCheckBox.checked = this.dontNagOnDelete;
    this.dontNagDeleteCheckBox.onCheck = () => {
	this.dontNagOnDelete = this.dontNagDeleteCheckBox.checked;
	Settings.write(settingsPrefix + "noNagOnDelete",DataType_Boolean, this.dontNagOnDelete);
    }
    this.dontNagOnDeleteLabel = new Label(this);
    this.dontNagOnDeleteLabel.useRichText = true;
    this.dontNagOnDeleteLabel.wordWrapping = true;
    this.dontNagOnDeleteLabel.text = "Suppress warnings from the Really Delete button<br/>" +
	"Caution: deleted files may be unrecoverable"
    this.dontNagSizer = new HorizontalSizer(this);
    this.dontNagSizer.add(this.dontNagDeleteCheckBox, 25);
    this.dontNagSizer.add(this.dontNagOnDeleteLabel, 75);
    
    this.settingsPage = new Control(this);
    this.settingsPage.sizer = new VerticalSizer(this);
    this.settingsPage.sizer.margin = 6;
    this.settingsPage.sizer.spacing = 6;
    this.settingsPage.sizer.add(this.directorySettingsGroupBox);
    this.settingsPage.sizer.add(this.dontNagSizer);
    this.settingsPage.sizer.addStretch();


    // tab box for pages
    this.tabBox = new TabBox();
    this.tabBox.addPage(this.cullPage, "Cull");
    this.tabBox.addPage(this.settingsPage, "Settings");
    this.tabBox.onPageSelected = (pageIndex) => {
	// if (pageIndex == 0) {
	//     mode = "bulk";
	//     if ( !this.bulkButtonsSizer.has(this.inputDirButton)) {
	// 	this.actionButtonSizer.remove( this.inputDirButton);
	// 	this.bulkButtonsSizer.insert(0, this.inputDirButton);
	//     }
	//     if ( !this.bulkButtonsSizer.has(this.inputFilesButton)) {
	// 	this.actionButtonSizer.remove( this.inputFilesButton);
	// 	this.bulkButtonsSizer.insert(1, this.inputFilesButton);

	//     if ( !this.bulkButtonsSizer.has(this.clearAllFilesButton)) {
	// 	this.actionButtonSizer.remove(this.clearAllFilesButton);
	// 	this.bulkButtonsSizer.insert(2, this.clearAllFilesButton);
	//     }
	//     if (!this.bulkPage.sizer.has(this.filesTreeBox)) {
	// 	this.settingsPage.sizer.remove(this.filesTreeBox);
	// 	this.bulkPage.sizer.insert(0, this.filesTreeBox, 75);
	// 	console.noteln("Swapping treebox for page " + pageIndex);
	//     }
	// } else if (pageIndex == 1) {
	//     mode = "quick";
	//     if ( !this.actionButtonSizer.has(this.inputDirButton)) {
	// 	this.bulkButtonsSizer.remove( this.inputDirButton);
	// 	this.actionButtonSizer.insert(0, this.inputDirButton);
	//     }
	//     if ( !this.actionButtonSizer.has(this.inputFilesButton)) {
	// 	this.bulkButtonsSizer.remove( this.inputFilesButton);
	// 	this.actionButtonSizer.insert(1, this.inputFilesButton);
	//     }
	//     if ( !this.actionButtonSizer.has(this.clearAllFilesButton)) {
	// 	this.bulkButtonsSizer.remove(this.clearAllFilesButton);
	// 	this.actionButtonSizer.insert(2, this.clearAllFilesButton);
	//     }
	//     if (!this.blinkPage.sizer.has(this.filesTreeBox)) {
	// 	console.noteln("Swapping treebox for page " + pageIndex);
	// 	this.bulkPage.sizer.remove(this.filesTreeBox);
	// 	this.blinkPage.sizer.insert(0, this.filesTreeBox, 75);
	//     }
	// }
	// this.updateFileList();
    };

    this.tabBox.currentPageIndex = 0;
    this.windowTitle = TITLE + " v" + VERSION;
    this.minWidth = 400; //>>??
    this.minHeight = 600;
//    this.setMinSize(800, 600);

    this.sizer = new VerticalSizer;
    this.sizer.spacing = 6;
    this.sizer.margin = 4;
    this.sizer.add( this.tabBox );
    this.sizer.add(this.playbackSizer);
    this.computeBitmapGroupBox.hide();
    this.sizer.add(this.computeBitmapGroupBox);
    this.sizer.add( this.buttons_Sizer );

   this.setMinWidth( 620 );
    var p = new Point();
    p.x = this.availableScreenRect.width -this.width - 50;
    p.y =  100;
    if (this.availableScreenRect.height - this.height < 100) {
	p.y = Math.max (0, (this.availableScreenRect.height - this.height)/2);
    }
    this.window.position = p;

    // Cleanup on close
    this.onClose = function() {
        if (playTimer) {
            playTimer.stop();
        }
	self.previewWindow.closeWindow();
    };
}

// Inherit from Dialog
CullDialog.prototype = new Dialog;

// Main execution
function main() {
    var dialog = new CullDialog();
    try {
	dialog.execute();
    } catch (ex) {
	console.criticalln("Fatal: " + ex);
    }
};

main();
