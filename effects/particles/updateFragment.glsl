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
  vec4 posp, velp;
  if (updatingPosition) {
    posp = lookup(0.0);
    velp = lookup(1.0);
  } else {
    posp = lookup(-1.0);
    velp = lookup(0.0);
  }
  vec3 pos = vec3(posp);
  vec3 vel = vec3(velp);
  
  // velocity update is applied to position as well
  vel += uHarmonicAccel * uDT * normalize(pos);
  
  if (updatingPosition) {
    gl_FragColor = vec4(pos + uDT * vel, posp[3]);
  } else {
    gl_FragColor = vec4(vel, velp[3]);
  }
}
