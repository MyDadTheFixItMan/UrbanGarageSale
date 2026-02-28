import AdminDashboard from './pages/AdminDashboard';
import About from './pages/About';
import Contact from './pages/Contact';
import CreateListing from './pages/CreateListing';
import Home from './pages/Home';
import ListingDetails from './pages/ListingDetails';
import Login from './pages/Login';
import Payment from './pages/Payment';
import Privacy from './pages/Privacy';
import Profile from './pages/Profile';
import ResetPassword from './pages/ResetPassword';
import SavedListings from './pages/SavedListings';
import TabTest from './pages/TabTest';
import Terms from './pages/Terms';
import UrbanPay from './pages/UrbanPay';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "AdminDashboard": AdminDashboard,
    "Contact": Contact,
    "CreateListing": CreateListing,
    "Home": Home,
    "ListingDetails": ListingDetails,
    "Login": Login,
    "Payment": Payment,
    "Privacy": Privacy,
    "Profile": Profile,
    "ResetPassword": ResetPassword,
    "SavedListings": SavedListings,
    "TabTest": TabTest,
    "Terms": Terms,
    "UrbanPay": UrbanPay,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};