import mongoose from 'mongoose'; 

const checkExternalAuth = async(req,res,next)=>{
    const userKey = req.headers['x-api-key'] || req.headers['X-API-Key'];

    if(!userKey){
        return res.status(401).json({ message: "Unauthorized: Missing API Key" });
    }

    try{
        const UserData = mongoose.model('UserData');
        const user = await UserData.findOne({walletAuthKey:userKey});
        // console.log("User found for API Key:", user);
        if (!user) {
            return res.status(401).json({ message: "Unauthorized: Invalid API Key" });
        }
        // console.log("User authenticated successfully:", user);
        req.userId = user.userId;
        next();
    }catch(error){
        console.error("Error during authentication:", error);
        res.status(500).json({ message: "Server Error during Authentication" });
    }
};

export default checkExternalAuth;