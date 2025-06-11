#include <pjsr/ResizeMode.jsh>
//#include "AutoStretch.js"
#include "PreviewWindow.js"

function main() {
    console.show();
    previewWindow = new PreviewWindow();
     var path = "/Volumes/G12T/Astro/starfront/SCA260/Capture/Owl Nebula/2025-05-18/Poseidon-M PRO/SCA260/2025-05-18/OIII/LIGHT_OIII_180.00s_1x1bin_deg_GAIN_125_OFFSET_20_-5.00C_0007.fits"
    var imageWindow =ImageWindow.open(path, "Preview"+Date.now(), "", true)[0];
    console.writeln("Image window: " + imageWindow + " is Null? " + imageWindow.isNull);
    let view = imageWindow.mainView, img = view.image;
    let stf = new AutoStretch();
    view.beginProcess();
    img.resample(750, 500, ResizeMode_AbsolutePixels, AbsoluteResizeMode_ForceWidth);
    stf.HardApply(view);
    view.endProcess();
    previewWindow.SetImage(imageWindow);
    imageWindow.show();
    imageWindow.forceClose();
    //previewWindow.show();
}
main();
