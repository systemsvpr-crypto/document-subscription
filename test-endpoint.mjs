const url = "https://script.google.com/macros/s/AKfycbxgmfdTJW--pSl-ypu83Lj01yksjLFZGLMRwvnvi_gEJh4xdYkb1Sx7smMjSnkYtm7U-A/exec?sheet=Master";

console.log('Testing URL:', url);

try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));

    const text = await res.text();
    console.log('--- FULL RESPONSE BODY ---');
    console.log(text);
    console.log('--- END BODY ---');
} catch (error) {
    console.error('Fetch error:', error);
}
