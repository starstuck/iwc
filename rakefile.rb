require 'rake/clean'

SRC = FileList['lib/*.js', 'lib/util/*.js']
TARGETS = ['iwc-all.js', 'iwc-all-debug.js', 'iwc-ajaxproxy.js', 'iwc-ajaxproxy-debug.js']
CLEAN.include(TARGETS)

RJS="node_modules/requirejs/bin/r.js"
RJS_ARGS="-o build-almond.js"

CLOSURE="closure-compiler"

file 'iwc-all-debug.js' => SRC.concat(['main.js'])  do |t|
  sh "#{RJS} #{RJS_ARGS} include=main optimize=none out=#{t.name}"
end

file 'iwc-all.js' => 'iwc-all-debug.js' do |t|
  sh "sed  -e 's/[ 	]*\\/\\/[ 	]1*#/#/' iwc-all-debug.js | cpp -P -C | closure-compiler > #{t.name}"
end

file 'iwc-ajaxproxy-debug.js' => SRC.concat(['ajaxproxy.js'])  do |t|
  sh "#{RJS} #{RJS_ARGS} include=ajaxproxy optimize=none out=#{t.name}"
end

file 'iwc-ajaxproxy.js' => 'iwc-ajaxproxy-debug.js' do |t|
  sh "sed  -e 's/[ 	]*\\/\\/[ 	]1*#/#/' iwc-ajaxproxy-debug.js | cpp -P -C | closure-compiler > #{t.name}"
end
task :build => TARGETS

task :test

task :default => :build

