import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ReturnToHubTarget } from "@/components/luminax/ReturnToHubTarget";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = "Page not found · LuminaXR Access";
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <ReturnToHubTarget className="not-found-return" />
      </div>
    </div>
  );
};

export default NotFound;
