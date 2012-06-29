// Copyright 2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

(function () {
  "use strict";
  
  var cos = Math.cos;
  var sin = Math.sin;
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.configure = function () {
    var parameters = {
    };
    return parameters;
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    var modelMatrix = mat4.create();
    mat4.identity(modelMatrix);
    
    var programW = glw.compile(programDesc, resources);
    
    var screenQuad = new glw.BufferAndArray([{
      attrib: programW.attribs.aPosition,
      components: 3
    }]);
    // TODO compensate for aspect ratio
    screenQuad.load([
      -2, -2, +1,
      +2, -2, +1,
      -2, +2, +1,
      +2, +2, +1
    ]);
    screenQuad.send(gl.STATIC_DRAW);

    // GLSL sandbox interface
    glw.useProgramW(programW);
    gl.uniform2f(glw.uniforms.surfaceSize, 1, 1); // TODO stub
    gl.uniform1i(glw.uniforms.backbuffer, 0); // TODO stub
    gl.uniform1f(glw.uniforms.zoom, 1); // TODO stub
    
    this.setState = function () {
      glw.useProgramW(programW);
      glw.setModelMatrix(modelMatrix);
      
      // GLSL sandbox interface
      gl.uniform2f(glw.uniforms.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
    };
    
    var t0 = Date.now() / 1000;
    this.draw = function () {
      var now = Date.now() / 1000 - t0;
      
      // GLSL sandbox interface
      gl.uniform1f(glw.uniforms.time, now);
      gl.uniform2f(glw.uniforms.mouse, sin(now), cos(now)); // TODO stub
      
      screenQuad.attrib();
      screenQuad.draw(gl.TRIANGLE_STRIP);
    };
    
    this.deleteResources = function () {
      programW.deleteResources();
      screenQuad.deleteResources();
    };
  }
  exports.Effect.prototype.viewDistance = function () { return 10; };
  exports.Effect.prototype.viewRadius = function () { return 1; };
  exports.Effect.prototype.nearClipFraction = function () { return 0.2; };
  exports.Effect.prototype.farClipDistance = function () { return 2; };
}());
