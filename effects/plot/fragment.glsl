#ifdef GL_ES
precision highp float;
#endif

varying vec4 vColor;
#if SPARK
varying vec2 vSparkCoord;
#endif

void main(void) {
  vec4 color = vColor;
  
#if SPARK
  color.rgb *= (1.0 - abs(vSparkCoord.t))
             * pow(1.0 - 2.0 * abs(vSparkCoord.s - 0.5), 0.2);
#endif
  
  gl_FragColor = color;
}
