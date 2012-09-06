RJS="echo node_modules/requirejs/bin/r.js"
RJS_ARGS=""

task :build do
  sh "echo Done"
end

task :default => :build
