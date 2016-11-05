// http://mdn-samples.mozilla.org/s/webrtc-capturestill/

(function() {
  // The width and height of the captured photo. We will set the
  // width to the value defined here, but the height will be
  // calculated based on the aspect ratio of the input stream.
  const MESSAGE_PREFIX = "#MyVoteMatters because";
  const MESSAGE_SUFFIX = "(share yours at myvotematters.today)";
  const MIN_WIDTH = 300;
  const MIN_WIDTH_RATIO = 0.5;
  var MARGIN = 30;
  var TEXT_HEIGHT = 40;
  var TEXT_PADDING = 10;
  var HORIZ_INC = 2*MARGIN;
  var VERT_INC = 2*MARGIN + TEXT_HEIGHT;
  const RED = "#ff3333";
  const BLUE = "#0066cc";

  var linkToShare = null;
  var CAMERA_STARTED = false;

  var width = 0;    // We will scale the photo width to this
  var height = 0;     // This will be computed based on the input stream

  // Either VideoShareTarget or UploadShareTarget.
  var shareTarget = null;

  // The various HTML elements we need to configure or control. These
  // will be set by the startup() function.

  var video = null;
  var localstream = null;
  var wrapper = null;
  var canvas = null;
  var context = null;
  var photo = null;
  var startbutton = null;
  var camerabutton = null;

  // FIXME: Replace with MediaDevices.getUserMedia.
  var getUserMedia =  (navigator.getUserMedia ||
                      navigator.webkitGetUserMedia ||
                      navigator.mozGetUserMedia ||
                      navigator.msGetUserMedia);


  var ui = {
    onclick: function(selector, handler) {
      [].forEach.call(document.querySelectorAll(selector), function(element) {
        element.addEventListener('click', handler);
      });
    },
    hide: function(element) {
      element.classList.add('no-display');
    },
    show: function(element) {
      element.classList.remove('no-display');
    },
    toCameraStarted: function() {
      this.hide(document.querySelector('#camerabutton'));
      this.show(document.querySelector('#streaming'));
    }
  };

  function startCamera() {
    connectCamera().then(function() {
      video.addEventListener('canplay', function(){
        (function loop() {
          addTextToImage();
          setTimeout(loop, 1000 / 60);
        })();
        resizeCanvas();
        video.play().then(ui.toCameraStarted.bind(ui)); // as a promise so button is not ready too early
      }, false);
      video.play().then(ui.toCameraStarted.bind(ui));
    }, createNoCameraUI);
  }

  function connectCamera() {
    return new Promise(function(resolve, reject) {
      if (!getUserMedia) {
        reject();
        return;
      }

      CAMERA_STARTED = true;
      getUserMedia = getUserMedia.bind(navigator);

      getUserMedia({ video: true, audio: false },
        function(stream) {
          if (navigator.mozGetUserMedia) {
            video.mozSrcObject = stream;
          } else {
            var vendorURL = window.URL || window.webkitURL;
            video.src = vendorURL.createObjectURL(stream);
          }
          localstream = stream;
          resolve();
        }, reject
      );
    });
  }

  function startup() {
    video = document.getElementById('video');
    shareTarget = new VideoShareTarget(video);

    wrapper = document.getElementById('video-wrapper');
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');
    photo = document.getElementById('photo');
    startbutton = document.getElementById('startbutton');
    camerabutton = document.getElementById('camerabutton');
    savebutton = document.getElementById('savebutton');

    // wait for Montserrat to be loaded
    // video wrapper is hidden at first to prevent weird flashing on page load
    // in theory document.fonts.ready works in FF and Chrome, but it doesn't, so use a hacky timeout instead
    setTimeout(function() {
      ui.show(document.querySelector('#video-wrapper'));
      resizeCanvas();
      createBackgroundSelfies();
    }, 100);

    // Event listeners

    camerabutton.addEventListener('click', function(ev){
      ga('send', 'event', 'camera', 'click');
      startCamera();
      ev.preventDefault();
    }, false);

    startbutton.addEventListener('click', function(ev){
      ga('send', 'event', 'start', 'click');
      takepicture();
      ev.preventDefault();
    }, false);

    savebutton.addEventListener('click', function(ev){
      ga('send', 'event', 'save', 'click');
      savepicture();
      ev.preventDefault();
    }, false);

    canvas.addEventListener('click', function(){
      ga('send', 'event', 'start', 'click');
      takepicture();
    }, false);

    ui.onclick('.cancel-button', function() {
      ga('send', 'event', 'cancel', 'click');
      untakepicture();
    });

    ui.onclick('.twitter-share-button', function() {
      ga('send', 'event', 'share', 'click', 'twitter');
      postToTwitter();
    });

    ui.onclick('.fb-share-button', function() {
      ga('send', 'event', 'share', 'click', 'facebook');
      postToFacebook();
    });

    ui.onclick('.download-button', function() {
      ga('send', 'event', 'share', 'click', 'download');
    });

    window.addEventListener('orientationchange', function() {
      setTimeout(resizeCanvas, 300); // FIXME can this be lower?
    });

    window.addEventListener('resize', function() {
      resizeCanvas();
    });

    if (window.OAuth) {
      initOAuth();
      return;
    }

    document.querySelector('#oauth').addEventListener('load', initOAuth);

    if (!getUserMedia) {
      ui.toCameraStarted();
      createNoCameraUI();
    } else {
      navigator.mediaDevices.enumerateDevices().then(function(devices) {
        if (devices.some(isVideoInput))
          return;

        ui.toCameraStarted();
        createNoCameraUI();

        function isVideoInput(device) {
          return device.kind == 'videoinput';
        }
      });
    }
  }

  function initOAuth() {
    // Initialize OAuth
    // http://blog.devteaminc.co/posting-a-canvas-image-to-twitter-using-oauth/
    var OAuthKey = "WDBN6HtSl2OSBHDCMdhaT_tMBRE";
    OAuth.initialize(OAuthKey);
  }

  function drawPlaceholder() {
    context.beginPath();
    context.fillStyle = "white";
    var INSIDE_MARGIN = width / 20; // of white polaroid
    context.rect(0, 0, width + 2*INSIDE_MARGIN, height + 2*INSIDE_MARGIN + 20*TEXT_HEIGHT + 2*TEXT_PADDING);
    context.fill();

    context.fillStyle = BLUE;
    context.textAlign = "center";
    context.font = (TEXT_HEIGHT/2) + "px Montserrat, Helvetica Neue, Helvetica, Arial, sans-serif";
    context.fillText("Share why YOUR vote matters", canvas.width/2, canvas.height - INSIDE_MARGIN - TEXT_HEIGHT + TEXT_PADDING*2);
    context.fillStyle = "black";

    context.beginPath();
    context.fillStyle = RED;
    context.rect(INSIDE_MARGIN, INSIDE_MARGIN, width, height);
    context.fill();
  }

  function resizeCanvas() {
    width = Math.min(MIN_WIDTH, Math.round(screen.width * MIN_WIDTH_RATIO));
    MARGIN = width / 15; // of blue wrapper
    var INSIDE_MARGIN = width / 20; // of white polaroid
    TEXT_HEIGHT = 2 * MARGIN;
    TEXT_PADDING = TEXT_HEIGHT / 4;
    HORIZ_INC = 2*INSIDE_MARGIN;
    VERT_INC = 2*INSIDE_MARGIN + TEXT_HEIGHT + 2*TEXT_PADDING;
    height = shareTarget.getHeight() / (shareTarget.getWidth()/width);

    // Firefox currently has a bug where the height can't be read from
    // the video, so we will make assumptions if this happens.

    if (isNaN(height)) {
      height = width / (4/3);
    }

    canvas.setAttribute('width', width + HORIZ_INC);
    canvas.setAttribute('height', height + VERT_INC);
    canvas.style.top = MARGIN + "px";
    wrapper.style.width = (width + HORIZ_INC + 2*MARGIN) + "px";
    wrapper.style.height = (height + VERT_INC + 2*MARGIN) + "px";
    $("input").css("width", width + HORIZ_INC + 2*MARGIN);

    if (!CAMERA_STARTED) {
      drawPlaceholder();
    }
  }

  function createNoCameraUI() {
    ga('send', 'event', 'no-camera', 'error');

    // Show an error message explaining that you
    // need to upload a photo instead
    ui.hide(document.querySelector("#canvas"));
    wrapper.classList.add('camera-failure');
    wrapper.classList.add('fgwhite');
    var textNode = document.createTextNode('Share why YOUR vote matters.');
    wrapper.appendChild(textNode);

    document.querySelector('#streaming .text').textContent = 'Select photo';
    shareTarget = new UploadShareTarget(textNode);
  }

  // Capture a photo by fetching the current contents of the video
  // and drawing it into a canvas, then converting that to a PNG
  // format data URL. By drawing it on an offscreen canvas and then
  // drawing that to the screen, we can change its size and/or apply
  // other changes before drawing it.

  function polaroid(canvas, context, width, height, fs) {
    context.beginPath();
    context.fillStyle = "white";
    var INSIDE_MARGIN = width / 20; // of white polaroid
    context.rect(0, 0, width + 2*INSIDE_MARGIN, height + 2*INSIDE_MARGIN + 20*TEXT_HEIGHT + 2*TEXT_PADDING);
    context.fill();

    context.fillStyle = BLUE;
    context.textAlign = "center";
    context.font = fs + "px Montserrat";
    context.fillText(MESSAGE_PREFIX, canvas.width/2, canvas.height - INSIDE_MARGIN - TEXT_HEIGHT + TEXT_PADDING);
    context.fillStyle = "black";
  }

  function takepicture() {
    ui.hide(document.querySelector('#streaming'));
    ui.show(document.querySelector('.input-wrapper'));
    var savebutton = document.querySelector('#savebutton');
    savebutton.value = 'Save';
    ui.show(document.querySelector('#savebutton'));
    shareTarget.captureImage();
  }

  function savepicture() {
    var savebutton = document.querySelector('#savebutton');
    savebutton.value = 'Saving...';
    uploadToImgur().then(function(response) {
      // Show this only after the upload to imgur is successful.
      ui.hide(savebutton);
      ui.hide(document.querySelector('.input-wrapper'));
      ui.show(document.querySelector('#share-photo'));

      linkToShare = response.data.link;
      document.querySelector('.download-button').href = linkToShare;
    }).catch(function(e){
      ga('send', 'event', 'share', 'error', 'imgur');
      onShareError('imgur', e);
    });
  }

  function untakepicture() {
    clearMessage();
    shareTarget.resumePreview();

    ui.show(document.querySelector('#streaming'));
    ui.hide(document.querySelector('#share-photo'));
    ui.hide(document.querySelector('.result'));
  }

  function getImageData() {
    var canvas = document.getElementById('canvas');
    var data = canvas.toDataURL('image/png');
    return data;
  }

  function getImageBlob() {
    var data = getImageData();
    var file = dataURItoBlob(data);
    return file;
  }

  function getMessage(fix) {
    var message = $(".input-message").val();
    if (fix) {
      message = MESSAGE_PREFIX + " " + message + " " + MESSAGE_SUFFIX;
    }
    return message;
  }

  function clearMessage() {
    document.querySelector('.input-message').value = '';
  }

  function postToTwitter() {
    var file = getImageBlob();
    var message = getMessage(true);
    OAuth.popup("twitter").then(function(result) {
      var data = new FormData();
      data.append('status', message);
      data.append('media[]', file, 'pic.png');
      return result.post('/1.1/statuses/update_with_media.json', {
        data: data,
        cache: false,
        processData: false,
        contentType: false
      });
    }).done(function(data){
      var url = data.entities.media[0].display_url;
      ga('send', 'event', 'share', 'success', 'twitter');
      onShareSuccess('twitter', "http://" + url);
    }).fail(function(e){
      ga('send', 'event', 'share', 'error', 'twitter');
      onShareError('twitter', e);
    });
  }

  function uploadToImgur() {
    var base64 = getImageData().split(',')[1];
    return new Promise(function(resolve, reject) {
      $.ajax({
        url: 'https://api.imgur.com/3/image',
        method: 'POST',
        data: {'image': base64},
        beforeSend: function (xhr){
          xhr.setRequestHeader('Authorization', 'Client-ID 527ddbd115eea70');
        }
      }).done(resolve).fail(reject);
    });
  }

  function postToFacebook() {
    // first post to Imgur to get a link
    FB.ui({
      method: 'feed',
      picture: linkToShare
    }, function(response){
      if (response && response.post_id) {
        var url = "https://facebook.com/" + response.post_id;
        onShareSuccess('facebook', url);
      } else {
        ga('send', 'event', 'share', 'error', 'facebook');
        onShareError('facebook', response.error_message);
      }
    });
  }

  function dataURItoBlob(dataURI) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0)
      byteString = atob(dataURI.split(',')[1]);
    else
      byteString = unescape(dataURI.split(',')[1]);
    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ia], {type:mimeString});
  }

  function onShareSuccess(service, url) {
    // Hide the share buttons,
    // show the result field
    ga('send', 'exception', {'exDescription': 'successful ' + service + ' share', 'exFatal': false});
    ui.hide(document.querySelector('#share-photo'));
    ui.show(document.querySelector('.result'));
    $(".result-text").html("Success! View your post <a target=\"_blank\" href=\"" + url + "\">here.</a>");
  }

  function onShareError(service, err) {
    console.log(err);
    ga('send', 'exception', {'exDescription': '[' + service + '] ' + err, 'exFatal': false});
    // Hide the share buttons,
    // show the result field
    ui.hide(document.querySelector('#share-photo'));
    ui.show(document.querySelector('.result'));
    $(".result-text").html("Sorry, something went wrong.");
  }

  function addTextToImage() {
    var INSIDE_MARGIN = width / 20;
    polaroid(canvas, context, width, height, TEXT_HEIGHT/2);
    context.drawImage(shareTarget.image, INSIDE_MARGIN, INSIDE_MARGIN, width, height);

    var message = getMessage();

    // limit to the length that will fit in a tweet
    var len = MESSAGE_PREFIX.length + MESSAGE_SUFFIX.length + 2;
    message = message.substr(0, len);

    drawMessage(canvas, context, message);
  }

  function drawMessage(canvas, context, message) {
    // autosize font while word-wrapping
    context.textAlign = "center";
    var div = 2;
    context.font = (TEXT_HEIGHT/div) + "px Montserrat";
    var lines = getLines(context, message, width);
    while (!textFits(context, lines, div - 1, width)) {
      div++;
      context.font = (TEXT_HEIGHT/div) + "px Montserrat";
      lines = getLines(context, message, canvas.width);
    }

    for (var i = 0; i < lines.length; i++) {
      var ypos = canvas.height - TEXT_PADDING*1.5;
      if (lines.length > 1) {
        ypos += (i - lines.length/2) * (TEXT_HEIGHT/(lines.length * div) + TEXT_PADDING/(div/2));
      }
      context.fillText(lines[i], canvas.width/2, ypos);
    }
  }

  function textFits(ctx, lines, maxLines, maxWidth) {
    if (lines.length > maxLines) return false;

    for (var i = 0; i < lines.length; i++) {
      if (ctx.measureText(lines[i]) > maxWidth) {
        return false;
      }
    }

    return true;
  }

  function getLines(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var currentLine = words[0];

    for (var i = 1; i < words.length; i++) {
        var word = words[i];
        var width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
  }

  function createBackgroundSelfies() {
    var SELFIE_COUNT = 15;
    const SELFIE_COL_COUNT = 4;
    const SELFIE_ROW_COUNT = 2;
    var INSIDE_MARGIN = width / 20;
    photoIndices = createArrayFromKnuthShuffle();
    var root = document.querySelector('#photos>div');
    photoIndices.slice(0, SELFIE_ROW_COUNT * SELFIE_COL_COUNT).forEach(function(index) {
      var img = document.createElement('img');
      img.src = 'img/samples/selfie-' + index + '.png';
      root.appendChild(img);
    });

    function createArrayFromKnuthShuffle() {
      var array = Array.apply(null, new Array(SELFIE_COUNT));
      array = array.map(function(_, i) { return i + 1; });
      var currentIndex = SELFIE_COUNT;
      var temp;
      var randomIndex;
      while (currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temp = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temp;
      }
      return array;
    }

  }

  function VideoShareTarget(video) {
    this.video = video;
    this.image = video;
  }

  VideoShareTarget.prototype.getWidth = function() {
    return this.video.videoWidth;
  }

  VideoShareTarget.prototype.getHeight = function() {
    return this.video.videoHeight;
  }

  VideoShareTarget.prototype.captureImage = function() {
    return new Promise(function(resolve) {
      this.video.pause();
      localstream.getTracks()[0].stop();
      CAMERA_STARTED = false;
      resolve();
    });
  }

  VideoShareTarget.prototype.resumePreview = function() {
    startCamera();
  }

  function UploadShareTarget(textNode) {
    this.upload = document.createElement('input');
    this.upload.type ='file';
    this.upload.style.display = 'none';
    this.upload.setAttribute('capture', 'camera');
    this.upload.setAttribute('accept', 'image/*');
    this.textNode = textNode;
    var controls = document.querySelector('#controls');
    controls.appendChild(this.upload);
  }

  UploadShareTarget.prototype.getWidth = function() {
    return this.image && this.image.width;
  }

  UploadShareTarget.prototype.getHeight = function() {
    return this.image && this.image.height;
  }

  UploadShareTarget.prototype.captureImage = function() {
    return new Promise(function(resolve) {
      this.upload.addEventListener('change', function(event) {
        // on upload click we should ...
        // 1) get rid of the error message
        // 2) Show the canvas again
        event.preventDefault();

        wrapper.classList.remove('camera-failure');
        try { // might have already removed this node
          wrapper.removeChild(this.textNode);
        } catch (err) {
        }
        ui.show(document.querySelector('#canvas'));

        var image = document.createElement('img');
        image.addEventListener('load', function(event) {
          this.computeRotation(image).then(function(degrees) {
            this.image = this.rotateImage(image, degrees);
            this.stepScale(canvas.width);


            // FIXME: This does not need to loop. Just update on each keystroke.
            (function loop() {
              addTextToImage();
              setTimeout(loop, 1000 / 60);
            })();
            resizeCanvas();
            resolve();
          }.bind(this));
        }.bind(this));

        var imageFile = event.target.files[0];
        // This will trigger image.onload after the image
        // loads.
        image.src = URL.createObjectURL(imageFile);
      }.bind(this));

    // initiate the sequence of upload dialog -> image load -> image resize
    this.upload.click();

    }.bind(this));
  }

  UploadShareTarget.prototype.stepScale = function(desiredWidth) {
    var width = this.image.width;
    var height = this.image.height;
    var stopWidth = desiredWidth * 2;
    var current = this.image;
    while (width > stopWidth) { // noprotect
      width = width / 2;
      height = height / 2;
      current = scaleTo(current, width, height);
    }
    this.image = current;

    function scaleTo(source, width, height) {
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      context.drawImage(source, 0, 0, width, height);
      return canvas;
    }
  }


  UploadShareTarget.prototype.rotateImage = function(rotationImage, degrees) {
    var rotationCanvas = document.createElement('canvas');
    var rotationContext = rotationCanvas.getContext('2d');
    var sideways = Math.abs(degrees) == 90;
    var finalWidth = sideways ? rotationImage.naturalHeight : rotationImage.naturalWidth;
    var finalHeight = sideways ? rotationImage.naturalWidth : rotationImage.naturalHeight;
    rotationCanvas.width = finalWidth;
    rotationCanvas.height = finalHeight;
    rotationContext.save();
    rotationContext.translate(finalWidth / 2, finalHeight / 2);
    rotationContext.rotate(degrees * Math.PI / 180);
    rotationContext.drawImage(rotationImage, - (rotationImage.naturalWidth / 2), - (rotationImage.naturalHeight / 2));
    rotationContext.restore();
    return rotationCanvas;
  }

  UploadShareTarget.prototype.computeRotation = function(image) {
    return new Promise(function(resolve) {
      EXIF.getData(image, function() {
        var degrees = 0;
        switch(EXIF.getTag(this, 'Orientation')) {
        case 8:
          degrees = -90;
          break;
        case 3:
          degrees = 180;
          break;
        case 6:
          degrees = 90;
        }
        resolve(degrees);
      });
    });
  }

  UploadShareTarget.prototype.resumePreview = function() {
    // Nothing to do for camera-less target.
  }

  // Set up our event listener to run the startup process
  // once loading is complete.
  window.addEventListener('DOMContentLoaded', startup, false);
})();
