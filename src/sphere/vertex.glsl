uniform float uTime;
uniform float uBigWavesElevation;
uniform vec2 uBigWavesFrequency;
uniform float uBigWavesSpeed;

varying float vElevation;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    // Calculate angle around the Y axis for wrapping waves
    float angle = atan(modelPosition.z, modelPosition.x);
    
    // Create the twisting wave effect
    float elevation = sin(angle * uBigWavesFrequency.x + uTime * uBigWavesSpeed) 
                    * sin(modelPosition.y * uBigWavesFrequency.y + uTime * uBigWavesSpeed) 
                    * uBigWavesElevation;
                    
    // Apply displacement along the normal
    modelPosition.xyz += normal * elevation;

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;

    // Pass elevation to fragment shader for coloring
    vElevation = elevation;
}