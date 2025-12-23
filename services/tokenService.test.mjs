import { generateJWT } from "./tokenService.mjs";



test('Valide la méthode generateJWT', async () => {


    const jwt = await generateJWT("255464-46544-44");
    expect(jwt).toBeDefined();
})