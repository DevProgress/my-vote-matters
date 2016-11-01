# my-vote-matters

To run:
```
cd my-vote-matters
python -m SimpleHTTPServer 8080
```
Sean AF Note: .

By using the following ruby libraries

'bootstrap-sass' 'compass'

gem install bootstrap-sass 
gem install compass

I have set up this project to use the CSS compilation tool Compass.

and to be able to compile and minify our own SASS, allowing us to cache and have greater control over our styling with mixins and extensions.

I have changed the config.rb file to work with our existing directory structure.

The main.sass file located in the sass folder is (mostly) identical to how main.css was before.

I have been editting the enhancements.sass file which is pulled into the CSS after.

compass compile

to output the updated css/main.css

to ease development, you can run compass watch and everytime a CSS file is editted it will automatically recompile.

minifiying can be specified at compile time via the CLI or ahead of time in the config.rb file.

I also use the html language 'haml'.  My haml file and a script that will compile it into html are in the haml folder.  this script automatically deletes and replaces index.html so be warned!!  








