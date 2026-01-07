const url = "https://script.google.com/macros/s/AKfycbwHu1aAXxmetBeCTHz6jITe4xZIGaVOP6N4exa1QDMggVkqNDfrVPEsWk_oM-o6Lp5S/exec?sheet=Master";

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
