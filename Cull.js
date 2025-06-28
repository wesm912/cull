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

    this.dirname = function(filePath) {
	let tmp =  filePath;
        let slash = tmp.lastIndexOf('/');
        if (slash > 0) {
            return tmp.slice(0, slash);
        }
	return tmp;
    }
    
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
		files.push({
                    path: found[j],
                    name: tmp,
                    keep: false,
                    reject: false,
		    reference: false,
		    moved: false
		})
            }
         };
      fileList = files;
      return files;
    };

    this.moveFiles = function(files, targetDirectory, type) {
        var moved = 0;
	console.writeln("target directory " + targetDirectory);
        for (var i = 0; i < files.length; i++) {
	    console.writeln(files[i].path);
            if ((type === "keep" && files[i].keep) || (type === "reject" && files[i].reject)) {
                try {
                    var targetPath = targetDirectory + "/" + files[i].name;
                    File.move(files[i].path, targetPath);
		    files[i].moved = true;
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
	var message = new MessageBox("Are you sure you want to delete " +
				     (files.length >1 ? "these files" : "this file") ,
				     "Delete Files", 0, 1, 2);
	let ret = message.execute();
	console.criticalln("message.execute() returned " + ret);
	return ret;
	if (StdButton_Ok == message.execute()) {
	    for (let i = 0; i < files.length; i++) {
		File.remove(files[i].path);
	    }
	}
    };
};


// Main dialog class
function CullDialog() {
    this.__base__ = Dialog;
    this.__base__();

    var fileManager = new FileManager();
//    var imagePreview = new ImagePreview();
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
    this.filesTreeBox.multipleSelection = false;


    // Directory controls
    this.inputDirButton = new PushButton(this);
    this.inputDirButton.text = "Load Directory...";
    let inputDirBmap = new Bitmap(":/icons/folder-open.png");
    let d = this.logicalPixelsToPhysical( 1 );
    d = 40*d;
    console.noteln("d is " + d + " after scaling");
    inputDirBmap = inputDirBmap.scaledTo(d);
    this.inputDirButton.icon = inputDirBmap;
//  this.inputDirButton.icon = this.scaledResource(":/icons/folder-open.png")
  
    
    this.inputFilesButton = new PushButton(this);
    this.inputFilesButton.text = "Load Files...";
    let inputFilesBmap = new Bitmap(":/icons/file-list.png");
    console.noteln("d is " + d + " after scaling");
    inputFilesBmap = inputFilesBmap.scaledTo(d);
    this.inputFilesButton.icon = inputFilesBmap;//this.scaledResource(":/icons/file-list.png")

    this.clearAllFilesButton = new PushButton(this);
    this.clearAllFilesButton.text = "Clear All";
    let clearAllBmap = new Bitmap(":/icons/clear-inverted.png");
    console.noteln("d is " + d + " after scaling");
    clearAllBmap = clearAllBmap.scaledTo(d);
    this.clearAllFilesButton.icon = clearAllBmap;

    // File operation controls
    this.moveKeepButton = new PushButton(this);
//    this.moveKeepButton.text = "Move Keep Files";
    this.moveKeepButton.icon = this.scaledResource(":/icons/save.png");
    this.moveKeepButton.backgroundColor = 0xFF00ee00;
    this.moveKeepButton.toolTip = "Move files marked to save to keepers directory."

    this.moveRejectButton = new PushButton(this);
//    this.moveRejectButton.text = "Move Reject Files";
    this.moveRejectButton.icon = this.scaledResource(":/file-explorer/cut.png");
    this.moveRejectButton.backgroundColor = 0xFFee0000;
    this.moveRejectButton.toolTip = "Move files marked to cut to rejects directory."

    // Action keypad buttons
    let dir = fileManager.dirname(#__FILE__);
    this.actionButtonSizer = new HorizontalSizer;
    
    this.keepButton = new PushButton(this)
    this.keepButton.text = "Keep";
    this.keepButton.icon = new Bitmap(dir + "/icons/icons8-k-key-50.png");

    this.cullButton = new PushButton(this)
    this.cullButton.text = "Cull";
    this.cullButton.icon = new Bitmap(dir + "/icons/icons8-x-key-50.png");

    this.trashButton = new PushButton(this)
    this.trashButton.text = "Really Delete";
    this.trashButton.icon = new Bitmap(dir + "/icons/icons8-remove-50.png");
    

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
    this.buttons_Sizer.add( this.ok_Button, 50, Align_Right );

    // Event handlers
    var self = this;

    this.inputDirButton.onClick = ( ) => {
        var dialog = new GetDirectoryDialog();
        if (dialog.execute()) {
            fileManager.inputDirectory = dialog.directory;
            fileList = fileManager.findFiles(fileManager.inputDirectory, true);
            this.updateFileList();
            if (fileList.length > 0) {
                currentIndex = 0;
                this.selectFile(0);
//		this.previewWindow.preComputeCache(fileList.map( (f) => f.path));
            }
        }
    };

    this.inputFilesButton.onClick = function() {
        var dialog = new OpenFileDialog();
	dialog.multipleSelections = true;
	dialog.filters = [[ "All Supported Formats", "xisf", "fits", "fit"]];
        if (dialog.execute()) {
            let files = dialog.fileNames;
	    for (let i = 0; i < files.length; i++) {
		fileList.push( {
                    path: fileManager.dirname(files[i]),
                    name: files[i],
                    keep: false,
                    reject: false,
		    reference: false
		})
	    }
	    
            self.updateFileList();
            if (fileList.length > 0) {
                currentIndex = 0;
                self.selectFile(0);
            }
	}
    };

    this.clearAllFilesButton.onClick = function() {
	fileList = [];
	self.updateFileList();
	this.previewWindow.cache.clear();
    }


    this.moveKeepButton.onClick = () => {
        if (!fileManager.keepDirectory) {
	    let msg = new MessageBox("Please choose a directory to hold files to keep");
	    msg.execute();
            fileManager.keepDirectory = this.getDirectory("Choose a directory for saved images");
	}
        if (!fileManager.keepDirectory) {
	    return;  //Canceled
	}
        var moved = fileManager.moveFiles(fileList, fileManager.keepDirectory, "keep");
        console.writeln("Moved " + moved + " files to keep directory");
        // Remove moved files from list
        fileList = fileList.filter(function(file) { return !file.moved; });
        self.updateFileList();
    };

    this.keepButton.onClick = () => {
        if (!fileManager.keepDirectory) {
	    let msg = new MessageBox("Please choose a directory to hold files to keep");
	    msg.execute();
            fileManager.keepDirectory = this.getDirectory("Choose a directory for saved images");
	}
        if (!fileManager.keepDirectory) {
	    return;  //Canceled
	}
 	let file = fileList[currentIndex];
	
	file.keep = true;
	console.show();
	console.writeln("Chose file " + file.path + ", " + file.name + ", " + file.keep);
	console.writeln("Keep directory is " + fileManager.keepDirectory);
	fileManager.moveFiles([file], fileManager.keepDirectory, "keep");
	this.updateFileList();
    }

    this.moveRejectButton.onClick = ( ) => {
        if (!fileManager.rejectDirectory) {
	    let msg = new MessageBox("Please choose a directory to hold files to remove");
	    msg.execute();
            fileManager.rejectDirectory = this.getDirectory("Choose a directory for saved images");
	}
        if (!fileManager.rejectDirectory) {
	    return;  //Canceled
	}
        var moved = fileManager.moveFiles(fileList, fileManager.rejectDirectory, "reject");
        console.writeln("Moved " + moved + " files to reject directory");
        // Remove moved files from list
        fileList = fileList.filter(function(file) { return !file.reject; });
        self.updateFileList();
    };

    this.cullButton.onClick = ( ) => {
        if (!fileManager.rejectDirectory) {
	    let msg = new MessageBox("Please choose a directory to hold files to remove");
	    msg.execute();
            fileManager.rejectDirectory = this.getDirectory("Choose a directory for saved images");
	}
        if (!fileManager.rejectDirectory) {
	    return;  //Canceled
	}
 	let file = fileList[currentIndex];
	file.keep = false;
	file.reject = true;
	console.show();
	console.writeln("Chose file " + file.path + ", " + file.name + ", " + file.keep);
	console.writeln("Rejectdirectory is " + fileManager.rejectDirectory);
	fileManager.moveFiles([file], fileManager.keepDirectory, "reject");
	this.updateFileList();
    };

    this.trashButton.onClick = () => {
	if (fileList.length == 0)
	    return;
	let fileObj = fileList[currentIndex];
	console.show()
	console.criticalln("deleting file at path " + fileObj.path);
	console.criticalln("fileList length before delete: " + fileList.length);
	let proceed = fileManager.deleteFiles([fileObj]);
	if (proceed == StdButton_Ok) {
	    fileObj.moved = true;
	    this.updateFileList();
	    console.criticalln("fileList length after delete: " + fileList.length);
	}
    };

    this.nextFile = () =>
    {
	if (fileList.length < 1)
	    return
        if (currentIndex < fileList.length - 1) {
            currentIndex++;
        } else {
	    currentIndex= 0;
	}
        self.selectFile(currentIndex);
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
//            self.updatePreview();
        }
    };

    // this.filesTreeBox.onKeyPress = function() {
    // 	return false;
    // };
    
    // Keyboard handling

    this.keepButton.onKeyPress = (key, modifiers) =>
    {
	if (key == Key_K ) {
	}
    };
    
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
	console.writeln("Before filter: length = " + fileList.length);
	fileList = fileList.filter( (f) => f.moved === false );
	console.writeln("After filter: length = " + fileList.length);
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
	    console.writeln("Setting current node to " + index);
            self.filesTreeBox.currentNode = self.filesTreeBox.child(index);
//	    self.filesTreeBox.currentNode.selected = !self.filesTreeBox.currentNode.selected;
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
    
    this.getDirectory = (caption)=> {
	var dialog = new GetDirectoryDialog();
	dialog.caption = caption;
	if (dialog.execute()) {
            return dialog.directory;
	}
	return null;
    };

    // this.rejectDirButton.onClick = function() {
    //     var dialog = new GetDirectoryDialog();
    //     if (dialog.execute()) {
    //         self.rejectDirEdit.text = dialog.directory;
    //         fileManager.rejectDirectory = dialog.directory;
    //     }
    // };



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
    this.playbackSizer.addSpacing(10);
    this.playbackSizer.add(label);
    this.playbackSizer.add(this.speedComboBox);
    this.playbackSizer.addStretch();

    /*
      page support
      page 1 and page 2 share some controls, namely the treebox, load directory, clear all
      buttons
      Page 1 is the bulk operations page, so has controls to move checked and move rejected
      items as a group.
      Page 2 is "blink" mode, so keyboard shortcut buttons for immediate save, immediate cull,
      and immediate delete are present
    */

    // Page 1 -- Bulk operations mode
    this.commonButtonsSizer= new VerticalSizer(this);
    
    this.bulkButtonsSizer = new VerticalSizer(this);
    this.bulkButtonsSizer.margin = 4;
    this.bulkButtonsSizer.spacing = 6;
    this.bulkButtonsSizer.add(this.inputDirButton);
    this.bulkButtonsSizer.add(this.inputFilesButton);
    this.bulkButtonsSizer.add(this.clearAllFilesButton);
    this.bulkButtonsSizer.add(this.moveKeepButton);
    this.bulkButtonsSizer.add(this.moveRejectButton);
    this.bulkButtonsSizer.addStretch();

    this.bulkPageControlsGroupBox = new GroupBox(this);
    this.bulkPageControlsGroupBox.sizer = this.bulkButtonsSizer;
//    this.bulkPageControlsGroupBox.adjustToContents();
    
    // Hide the action buttons initially
    this.actionButtonControl = new Control(this)
    //    this.actionButtonControl.hide();
    this.actionButtonSizer = new VerticalSizer();
    this.actionButtonSizer.add(this.keepButton);
    this.actionButtonSizer.add(this.cullButton);
    this.actionButtonSizer.add(this.trashButton);
    this.actionButtonControl.sizer = this.actionButtonSizer;

    this.bulkPage = new Control(this);
    this.bulkPage.sizer = new HorizontalSizer(this);
    with (this.bulkPage.sizer) {
        margin = 6;
        spacing = 6;
	add(this.filesTreeBox,75);
	add(this.bulkPageControlsGroupBox, 25);
    }

    this.blinkPage = new Control(this);
    this.blinkPage.sizer = new HorizontalSizer();
    this.blinkPage.sizer.margin = 6;
    this.blinkPage.sizer.spacing = 6;
    this.blinkPage.sizer.add(this.actionButtonControl,25);


    // tab box for pages
    this.tabBox = new TabBox();
    this.tabBox.addPage(this.bulkPage, "Bulk ops");
    this.tabBox.addPage(this.blinkPage, "Fast cull");
    this.tabBox.onPageSelected = (pageIndex) => {
	if (pageIndex == 0) {
	    if ( !this.bulkButtonsSizer.has(this.inputDirButton)) {
		this.actionButtonSizer.remove( this.inputDirButton);
		this.bulkButtonsSizer.insert(0, this.inputDirButton);
	    }
	    if ( !this.bulkButtonsSizer.has(this.inputFilesButton)) {
		this.actionButtonSizer.remove( this.inputFilesButton);
		this.bulkButtonsSizer.insert(1, this.inputFilesButton);
	    }
	    if ( !this.bulkButtonsSizer.has(this.clearAllFilesButton)) {
		this.actionButtonSizer.remove(this.clearAllFilesButton);
		this.bulkButtonsSizer.insert(2, this.clearAllFilesButton);
	    }
	    if (!this.bulkPage.sizer.has(this.filesTreeBox)) {
		this.blinkPage.sizer.remove(this.filesTreeBox);
		this.bulkPage.sizer.insert(0, this.filesTreeBox, 75);
		console.noteln("Swapping treebox for page " + pageIndex);
	    }
	} else if (pageIndex == 1) {
	    if ( !this.actionButtonSizer.has(this.inputDirButton)) {
		this.bulkButtonsSizer.remove( this.inputDirButton);
		this.actionButtonSizer.insert(0, this.inputDirButton);
	    }
	    if ( !this.actionButtonSizer.has(this.inputFilesButton)) {
		this.bulkButtonsSizer.remove( this.inputFilesButton);
		this.actionButtonSizer.insert(1, this.inputFilesButton);
	    }
	    if ( !this.actionButtonSizer.has(this.clearAllFilesButton)) {
		this.bulkButtonsSizer.remove(this.clearAllFilesButton);
		this.actionButtonSizer.insert(2, this.clearAllFilesButton);
	    }
	    if (!this.blinkPage.sizer.has(this.filesTreeBox)) {
		console.noteln("Swapping treebox for page " + pageIndex);
		this.bulkPage.sizer.remove(this.filesTreeBox);
		this.blinkPage.sizer.insert(0, this.filesTreeBox, 75);
	    }
	}
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
    this.sizer.add( this.buttons_Sizer );

   this.setMinWidth( 620 );
 
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
