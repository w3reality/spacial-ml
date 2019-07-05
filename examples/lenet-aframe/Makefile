# lazy generate a script-tag module for TspAdapter

all: tsp-adapter.min.js

# npm i babel-preset-env -D
tsp-adapter.min.js: ../../src/tsp-adapter.js
	echo 'window.TspAdapter = (function () { var exports = {};' > $@
	cat $< | npx babel --presets env | uglifyjs -c drop_console=true >> $@
	echo 'return TspAdapter; })();' >> $@

clean:
	rm -f tsp-adapter.min.js
