SOURCES=AutoStretch.js Cull.js PreviewWindow.js ProgressBar.js reticle.js README.md
ICONS=icons/icons8-remove-50.png

all: clean package

clean:
	rm -f cull.tar.gz
	rm -rf Cull

package:
	mkdir -p Cull/icons
	cp $(SOURCES) Cull
	cp ${ICONS} Cull/icons
	tar cfvz cull.tar.gz Cull
