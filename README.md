# cull
A cull script for PixInsight

This script is designed first and foremost to quickly view a set of subframes, and move keepers
to a directory for further processing, and to move rejected subframes for further consideration,
or immediately delete tham. This is the culling process. Quite a few catalog or collection based
photography programs have such a feature.

Run the main script, Cull.js, via PI's Execute Script File menu item.

Files can be loaded by one of two means:
1. The Load Directory button will load all image files (XISF or FITS) from a directory you choose,
and will recursively search all subdirectories for files.
2. The Load Files button allows you to navigate to a directory and manually select files to load.

Loading operations are fast, since they only populate a scrolling list with filenames.

In order to speed up browsing, there is an option presented to precompute a bitmap cache. Basically,
the script saves a modified bitmap that can be cached and loaded quickly into a fixed window called
the Cull Preview. Computing these bitmaps is an expensive operation; depending on the processor speed
and memory allocated to PixInsight, it is entirely possible to run out of memory before the processing
is completed. The solution is to load files or directories 25 or so at a time.

Pressing the Up or Down arrow keys move through the list one line at a time, and the Cull Preview should
now display the stretched image of the new line. Either the scrolling list, or an area outside any
buttons must be clicked to obtain proper keyboard focus.

Press the 'K' key to mark a file to keep, the 'X' key to mark a file to delete, and the Delete or
Backspace key to immediately delete a file.

The Save File button moves files marked to keep to a directory you specify. Similarly, the Move Rejects
button moves files marked to reject to a directory for rejects. If you haven't already specified
directories for keepers or rejects, you'll be prompted to do so the first time you press one of these
buttons. These directories can also be set in the Settings tab.

Once the files are loaded and the bitmap cache filled, you can "blink" through them rapidly by hitting
the Play button. The spacebar will stop or start play if the Play button has been clicked (has keyboard
focus). The 'K' or 'X' keys can be used during play to mark stretches that can be returned to to
individually mark a group of files. Multiple selections can also be marked with these keys.

Finally, the Really Delete button will remove a file from disk. Depending on the OS, it may go to a
trash bin, or may actually be deleted; it depends on how the File.remove call works on different platforms.
You will be prompted each time you try to delete a set of files. You can turn off this prompt also
in the Settings tab.

Be cautious with Really Delete. The files you delete may be unrecoverable!! For whatever reason, you may have
a sequence of subframes that have no value whatsoever; then use Delete. I use this when I get a bad
batch of sky flats, say some clouds passed through during collection.
