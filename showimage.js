#include <pjsr/ResizeMode.jsh>
//#include "AutoStretch.js"
#include "PreviewWindow.js"

function main() {
    console.show();
    previewWindow = new PreviewWindow(new Frame);
     var path = "/Volumes/G12T/Astro/starfront/SCA260/Capture/Owl Nebula/2025-05-18/Poseidon-M PRO/SCA260/2025-05-18/OIII/LIGHT_OIII_180.00s_1x1bin_deg_GAIN_125_OFFSET_20_-5.00C_0007.fits"
    console.writeln("passing path " + path);
    previewWindow.SetImage(path);
    let objectra = null, objectdec = null, kw = previewWindow.cullWindow.keywords;
    for (let i = 0; i < kw.length; i++) {
	let name = kw[i].name;
        let value = kw[i].strippedValue;
	if (name == "RA")
	    objectra = value;
	else if (name == "DEC")
	    objectdec = value;
    }
    console.writeln("ObjectRA and ObjectDEC values are " + objectra + " and " + objectdec);

}
main();
