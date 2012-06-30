#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uState;
uniform float uResolution;
uniform float uDT;
uniform float uHarmonicAccel;

vec4 lookup(float offset) {
  return texture2D(uState, (gl_FragCoord.xy + vec2(offset, 0.0)) / uResolution);
}

void main(void) {
  bool updatingPosition = mod(gl_FragCoord.x, 2.0) < 1.0;
  vec3 pos, vel;
  if (updatingPosition) {
    pos = vec3(lookup(0.0));
    vel = vec3(lookup(1.0));
  } else {
    pos = vec3(lookup(-1.0));
    vel = vec3(lookup(0.0));
  }
  
  // velocity update is applied to position as well
  vel += uHarmonicAccel * uDT * normalize(pos);
  
  if (updatingPosition) {
    gl_FragColor = vec4(pos + uDT * vel, 1.0);
  } else {
    gl_FragColor = vec4(vel, 1.0);
  }
}
