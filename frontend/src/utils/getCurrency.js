export const getCurrencyFromIP = async () => {
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        console.log(data.currency)
        return data.currency || "USD"; // Default to USD if not found
    } catch (error) {
        console.error("Error fetching currency:", error);
        return "USD";
    }
};
