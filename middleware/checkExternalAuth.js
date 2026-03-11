

const checkExternalAuth = async(req,res,next,seceret_key)=>{
    const userKey = req.headers['X-API-Key'];

    if(!userKey){
        return res.status(401).json({ message: "Unauthorized: Missing API Key" });
    }

    try{
        const mongoose = await import('mongoose')
        const UserData = mongoose.default.model('UserData');
        const user = await UserData.findOne({walletAuthKey:userKey});

        if (!user) {
            return res.status(401).json({ message: "Unauthorized: Invalid API Key" });
        }

        req.user = user;
        next();
    }catch(error){
        res.status(500).json({ message: "Server Error during Authentication" });
    }
};

export default checkExternalAuth;