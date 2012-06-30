#ifdef GL_ES
precision highp float;
#endif

varying vec3 vColor;

void main(void) {
  vec3 color = vColor;
  
#if SHAPE_SOFT
    color *= max(0.0, 1.0 - 2.0 * length(gl_PointCoord - 0.5));
#endif

  gl_FragColor = vec4(color, 1.0);
}
