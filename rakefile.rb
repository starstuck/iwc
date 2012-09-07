require 'rake/clean'

SRC = FileList['lib/*.js', 'lib/util/*.js', 'main.js']
TARGETS = ['iwc-all.js', 'iwc-all-debug.js']
CLEAN.include(TARGETS)

RJS="node_modules/requirejs/bin/r.js"
RJS_ARGS="-o build-almond.js"


file 'iwc-all.js' => SRC do |t|
  sh "#{RJS} #{RJS_ARGS} include=main out=#{t.name}"
end

file 'iwc-all-debug.js' => SRC do |t|
  sh "#{RJS} #{RJS_ARGS} include=main optimize=none out=#{t.name}"
end

task :build => TARGETS

task :test

task :default => :build

