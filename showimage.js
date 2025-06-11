#include "AutoStretch.js"

function main() {
    console.show();
     var path = "/Volumes/G12T/Astro/starfront/SCA260/Capture/Owl Nebula/2025-05-18/Poseidon-M PRO/SCA260/2025-05-18/OIII/LIGHT_OIII_180.00s_1x1bin_deg_GAIN_125_OFFSET_20_-5.00C_0007.fits"
    var imageWindow =ImageWindow.open(path, "Preview"+Date.now(), "", true)[0];
    console.writeln("Image window: " + imageWindow + " is Null? " + imageWindow.isNull);
    var autoStretch = new AutoStretch();
    autoStretch.Apply(imageWindow.mainView);
    imageWindow.show();
}
main();
