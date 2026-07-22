import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPassword() {
  useEffect(() => {
    document.title = "Forgot Password | Vote+";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <div className="flex-1 flex flex-col justify-center px-5 max-w-sm mx-auto w-full py-10">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2 px-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to sign in
            </Button>
          </Link>

          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Reset password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Self-service reset is currently disabled. Contact your administrator to reset your password.
          </p>
        </div>
      </div>
    </div>
  );
}
