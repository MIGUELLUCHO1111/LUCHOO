export const SecurityRules = {
  dangerousPatterns: /\b(union|select|insert|update|delete|drop|script|eval)\b/i,

  isSafe: (val) => {
    if (!val) return true;
    
    
    const isDangerous = SecurityRules.dangerousPatterns.test(val);
    

    console.log(`Input: ${val} | ¿Es peligroso?: ${isDangerous}`);
    
    return !isDangerous; 
  }
};