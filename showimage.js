#include <pjsr/ResizeMode.jsh>
#include <pjsr/StarDetector.jsh>    
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
    let imgWindow = ImageWindow.open(path)[0];
    let win = imgWindow.mainView.image;
    let stats = new ImageStatistics(win);
    stats.generate(win);
    console.criticalln("stddev is " + stats.stdDev);

    function detectStars(sourceImage) {
	let detector = new StarDetector;
	detector.upperLimit = 0.8;
	let maxBrightStars = 400; 

	// Console Detector Progress
	let lastProgressPc = 0;
	detector.progressCallback =
            (count, total) => {
		if (count == 0) {
                    console.write("<end><cbr>Detecting stars:   0%");
                    lastProgressPc = 0;
                    processEvents();
		}
		else {
                    let pc = Math.round(100 * count / total);
                    if (pc > lastProgressPc) {
			console.write(format("<end>\b\b\b\b%3d%%", pc));
			lastProgressPc = pc;
			processEvents();
                    }
		}
		return true;
            };

	let S = detector.stars(sourceImage);
	console.writeln("");

	let stars = []
	let radius = 2;

	let numStars = Math.min(S.length, maxBrightStars);
	// Set up the stars array for DynamicPSF: Take the n brightest stars that are lower than the max
	console.writeln("Stars detected: " + S.length);
	for (let i = 0; i < numStars; ++i) {
            stars.push([
		0, 0, DynamicPSF.prototype.Star_DetectedOk, S[i].pos.x - radius,
		S[i].pos.y - radius,
		S[i].pos.x + radius, S[i].pos.y + radius,
		S[i].pos.x, S[i].pos.y
            ]);
	}
	return stars;
    }

    function generatePSFs(sourceImage, starsList) {
	let P = new DynamicPSF;
	with (P) {
            views = [[sourceImage.id]];
            astrometry = false;
            autoAperture = true;
            searchRadius = 2;
            circularPSF = false;
            autoPSF = false;
            gaussianPSF = true;
            moffatPSF = false;
            moffat10PSF = false;
            moffat8PSF = false;
            moffat6PSF = false;
            moffat4PSF = false;
            moffat25PSF = false;
            moffat15PSF = false;
            lorentzianPSF = false;
            variableShapePSF = false;
            stars = starsList;
            executeGlobal();
	}

	return P.psf;
    }
    let psf = generatePSFs(win , detectStars(win));
    console.criticalln (psf);
    previewWindow.closeWindow();
    imgWindow.forceClose();
}
main();
