/*
 * PixInsight File Copy Script
 * Recursively searches for FITS and XISF files and copies them to output directory
 */

#feature-id    Utilities > File Copy Tool
#feature-info  A script to recursively copy FITS and XISF files from input to output directory

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>

function FileCopyDialog() {
   this.__base__ = Dialog;
   this.__base__();

   // Initialize variables
   this.inputDirectory = "";
   this.outputDirectory = "";
   this.foundFiles = [];
   this.copiedFiles = 0;
   this.failedFiles = 0;

   // Helper function to recursively find files
   this.findFiles = function(directory, extensions) {
      var files = [];
      var fileFind = new FileFind;

      if (fileFind.begin(directory + "/*")) {
         do {
            if (fileFind.isDirectory) {
               if (fileFind.name != "." && fileFind.name != "..") {
                  // Recursively search subdirectories
                  var subFiles = this.findFiles(directory + "/" + fileFind.name, extensions);
                  files = files.concat(subFiles);
               }
            } else {
               // Check if file has desired extension
               var fileName = fileFind.name.toLowerCase();
               for (var i = 0; i < extensions.length; i++) {
                  if (fileName.endsWith("." + extensions[i].toLowerCase())) {
                     files.push(directory + "/" + fileFind.name);
                     break;
                  }
               }
            }
         } while (fileFind.next());
      }

      return files;
   };

   // Helper function to copy files
   this.copyFiles = function() {
      this.copiedFiles = 0;
      this.failedFiles = 0;
      console.writeln("Writing " + this.foundFiles.length + " files to " + this.outputDirectory);
      //console.writeln("Found " + this.parent.foundFiles.length + " files");
            //var progressDialog = new ProgressDialog("Copying files...", "Initializing...", 0, this.foundFiles.length);
      //progressDialog.show();

      try {
         for (var i = 0; i < this.foundFiles.length; i++) {
  /*           if (progressDialog.wasCanceled) {
               break;
            }
 */
            var sourceFile = this.foundFiles[i];
            var fileName = File.extractName(sourceFile) + File.extractExtension(sourceFile);
            var targetFile = this.outputDirectory + "/" + fileName;

            //progressDialog.setProgressText("Copying: " + fileName);
            //progressDialog.setValue(i);
            //processEvents();

            try {
               // Check if target file already exists
   /*             if (File.exists(targetFile)) {
                  var result = (new MessageBox(
                     "File already exists: " + fileName + "\n\nOverwrite?",
                     "File Exists",
                     StdIcon_Question,
                     StdButton_Yes | StdButton_No | StdButton_Cancel
                  )).execute();

                  if (result == StdButton_Cancel) {
                     break;
                  } else if (result == StdButton_No) {
                     continue;
                  }
               }
 */
               // Copy the file
               console.writeln("copying " + sourceFile + " to " + targetFile);
               File.copyFile(targetFile, sourceFile );
               this.copiedFiles++;

            } catch (error) {
               console.writeln("Failed to copy " + fileName + ": " + error.message);
               this.failedFiles++;
            }
         }
      } finally {
         //progressDialog.hide();
      }

      // Show results
      var message = "Copy operation completed!\n\n" +
                   "Files copied: " + this.copiedFiles + "\n" +
                   "Files failed: " + this.failedFiles;

      (new MessageBox(message, "Copy Complete", StdIcon_Information, StdButton_Ok)).execute();
   };

   // Input directory selection
   this.inputDirLabel = new Label(this);
   this.inputDirLabel.text = "Input Directory:";
   this.inputDirLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.inputDirLabel.minWidth = 100;

   this.inputDirEdit = new Edit(this);
   this.inputDirEdit.readOnly = true;
   this.inputDirEdit.text = this.inputDirectory;

   this.inputDirButton = new PushButton(this);
   this.inputDirButton.text = "Browse...";
   this.inputDirButton.onClick = function() {
      var dialog = new GetDirectoryDialog();
      dialog.caption = "Select Input Directory";
      dialog.initialPath = this.parent.inputDirectory;

      if (dialog.execute()) {
         this.parent.inputDirectory = dialog.directory;
         this.parent.inputDirEdit.text = dialog.directory;
      }
   };

   this.inputDirSizer = new HorizontalSizer;
   this.inputDirSizer.spacing = 4;
   this.inputDirSizer.add(this.inputDirLabel);
   this.inputDirSizer.add(this.inputDirEdit, 100);
   this.inputDirSizer.add(this.inputDirButton);

   // Output directory selection
   this.outputDirLabel = new Label(this);
   this.outputDirLabel.text = "Output Directory:";
   this.outputDirLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.outputDirLabel.minWidth = 100;

   this.outputDirEdit = new Edit(this);
   this.outputDirEdit.readOnly = true;
   this.outputDirEdit.text = this.outputDirectory;

   this.outputDirButton = new PushButton(this);
   this.outputDirButton.text = "Browse...";
   this.outputDirButton.onClick = function() {
      var dialog = new GetDirectoryDialog();
      dialog.caption = "Select Output Directory";
      dialog.initialPath = this.parent.outputDirectory;

      if (dialog.execute()) {
         (new MessageBox("Setting output directory to " + dialog.directory, "Error", StdIcon_Error, StdButton_Ok)).execute();
         this.parent.outputDirectory = dialog.directory;
         this.parent.outputDirEdit.text = dialog.directory;
      }
   };

   this.outputDirSizer = new HorizontalSizer;
   this.outputDirSizer.spacing = 4;
   this.outputDirSizer.add(this.outputDirLabel);
   this.outputDirSizer.add(this.outputDirEdit, 100);
   this.outputDirSizer.add(this.outputDirButton);

   // File extensions section
   this.extensionsLabel = new Label(this);
   this.extensionsLabel.text = "File Extensions:";
   this.extensionsLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.fitsCheckBox = new CheckBox(this);
   this.fitsCheckBox.text = "FITS files (*.fits, *.fit, *.fts)";
   this.fitsCheckBox.checked = true;

   this.xisfCheckBox = new CheckBox(this);
   this.xisfCheckBox.text = "XISF files (*.xisf)";
   this.xisfCheckBox.checked = true;

   this.extensionsSizer = new VerticalSizer;
   this.extensionsSizer.spacing = 4;
   this.extensionsSizer.add(this.extensionsLabel);
   this.extensionsSizer.add(this.fitsCheckBox);
   this.extensionsSizer.add(this.xisfCheckBox);

   // Scan button
   this.scanButton = new PushButton(this);
   this.scanButton.text = "Scan for Files";
   this.scanButton.onClick = function() {
      if (this.parent.inputDirectory == "") {
         (new MessageBox("Please select an input directory first.", "Error", StdIcon_Error, StdButton_Ok)).execute();
         return;
      }

      var extensions = [];
      if (this.parent.fitsCheckBox.checked) {
         extensions.push("fits");
         extensions.push("fit");
         extensions.push("fts");
      }
      if (this.parent.xisfCheckBox.checked) {
         extensions.push("xisf");
      }

      if (extensions.length == 0) {
         (new MessageBox("Please select at least one file type.", "Error", StdIcon_Error, StdButton_Ok)).execute();
         return;
      }

      console.writeln("Scanning directory: " + this.parent.inputDirectory);
      this.parent.foundFiles = this.parent.findFiles(this.parent.inputDirectory, extensions);

      this.parent.statusLabel.text = "Found " + this.parent.foundFiles.length + " files";
      this.parent.copyButton.enabled = (this.parent.foundFiles.length > 0);

      console.writeln("Found " + this.parent.foundFiles.length + " files");
   };

   // Status label
   this.statusLabel = new Label(this);
   this.statusLabel.text = "Ready to scan...";
   this.statusLabel.textAlignment = TextAlign_Center | TextAlign_VertCenter;

   // Copy button
   this.copyButton = new PushButton(this);
   this.copyButton.text = "Copy Files";
   this.copyButton.enabled = false;
   this.copyButton.onClick = function() {
      if (this.parent.outputDirectory == "") {
         (new MessageBox("Please select an output directory first.", "Error", StdIcon_Error, StdButton_Ok)).execute();
         return;
      }

      if (this.parent.inputDirectory == this.parent.outputDirectory) {
         (new MessageBox("Input and output directories cannot be the same.", "Error", StdIcon_Error, StdButton_Ok)).execute();
         return;
      }

      // Create output directory if it doesn't exist
      if (!File.directoryExists(this.parent.outputDirectory)) {
         try {
            File.createDirectory(this.parent.outputDirectory);
         } catch (error) {
            (new MessageBox("Failed to create output directory: " + error.message, "Error", StdIcon_Error, StdButton_Ok)).execute();
            return;
         }
      }

      this.parent.copyFiles();
   };

   // Button sizer
   this.buttonSizer = new HorizontalSizer;
   this.buttonSizer.spacing = 8;
   this.buttonSizer.addStretch();
   this.buttonSizer.add(this.scanButton);
   this.buttonSizer.add(this.copyButton);
   this.buttonSizer.addStretch();

   // Close button
   this.closeButton = new PushButton(this);
   this.closeButton.text = "Close";
   this.closeButton.onClick = function() {
      this.dialog.ok();
   };

   this.closeSizer = new HorizontalSizer;
   this.closeSizer.addStretch();
   this.closeSizer.add(this.closeButton);

   // Main sizer
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add(this.inputDirSizer);
   this.sizer.add(this.outputDirSizer);
   this.sizer.addSpacing(10);
   this.sizer.add(this.extensionsSizer);
   this.sizer.addSpacing(10);
   this.sizer.add(this.statusLabel);
   this.sizer.add(this.buttonSizer);
   this.sizer.addSpacing(10);
   this.sizer.add(this.closeSizer);

   // Dialog properties
   this.windowTitle = "File Copy Tool";
   this.adjustToContents();
   this.setMinSize(400, 300);
}

FileCopyDialog.prototype = new Dialog;

// Progress dialog for file operations
function ProgressDialog(title, text, min, max) {
   this.__base__ = Dialog;
   this.__base__();

   this.canceled = false;
   this.minValue = min;
   this.maxValue = max;
   this.currentValue = min;

   this.titleLabel = new Label(this);
   this.titleLabel.text = title;
   this.titleLabel.textAlignment = TextAlign_Center | TextAlign_VertCenter;

   this.textLabel = new Label(this);
   this.textLabel.text = text;
   this.textLabel.textAlignment = TextAlign_Center | TextAlign_VertCenter;

   this.cancelButton = new PushButton(this);
   this.cancelButton.text = "Cancel";
   this.cancelButton.onClick = function() {
      this.parent.canceled = true;
      this.parent.cancel();
   };

   this.buttonSizer = new HorizontalSizer;
   this.buttonSizer.addStretch();
   this.buttonSizer.add(this.cancelButton);
   this.buttonSizer.addStretch();

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add(this.titleLabel);
   this.sizer.add(this.textLabel);
//   this.sizer.add(this.progressBar);
   this.sizer.add(this.buttonSizer);

   this.windowTitle = title;
   this.adjustToContents();

   this.setProgressText = function(text) {
      this.textLabel.text = text;
   };

   this.setValue = function(value) {
      this.currentValue = value;
//      this.progressBar.setValue(value);
   };

   this.wasCanceled = function() {
      return this.canceled;
   };
}

ProgressDialog.prototype = new Dialog;

// Main execution
function main() {
   console.hide();

   var dialog = new FileCopyDialog();
   dialog.execute();
}

main();
