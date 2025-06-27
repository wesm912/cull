#include "ProgressDialog.js"


function main() {
    let dialog = new ProgressDialog;
    console.writeln("Opening dialog");
    dialog.open();
    dialog.callback(46, 100);
    for (let i = 0; i < 100000; i++) {
	processEvents()
    } 
}

main();
