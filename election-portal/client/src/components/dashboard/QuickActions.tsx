import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PlusCircle, Users, UserPlus, CheckCircle, UserCircle, Edit } from "lucide-react";
import { DashboardStats } from "@/lib/types";

interface QuickActionsProps {
  recentActivity: DashboardStats['recentActivity'];
}

export function QuickActions({ recentActivity }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <Link href="/elections/create">
            <Button className="w-full" size="lg">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Election
            </Button>
          </Link>
          
          <Link href="/voters">
            <Button variant="secondary" className="w-full" size="lg">
              <Users className="mr-2 h-4 w-4" />
              Generate Voter Accounts
            </Button>
          </Link>

          <Link href="/elections">
            <Button variant="outline" className="w-full" size="lg">
              <UserPlus className="mr-2 h-4 w-4" />
              Elections
            </Button>
          </Link>
        </div>

        <div className="mt-8">
          <h3 className="text-md font-medium text-gray-900 mb-3">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => {
              let IconComponent;
              let iconColorClass;
              
              switch (activity.type) {
                case 'success':
                  IconComponent = CheckCircle;
                  iconColorClass = "text-green-600 bg-green-100";
                  break;
                case 'info':
                  IconComponent = UserCircle;
                  iconColorClass = "text-blue-600 bg-blue-100";
                  break;
                case 'warning':
                  IconComponent = Edit;
                  iconColorClass = "text-purple-600 bg-purple-100";
                  break;
                default:
                  IconComponent = CheckCircle;
                  iconColorClass = "text-green-600 bg-green-100";
              }
              
              return (
                <div key={index} className="flex items-start">
                  <div className={`flex-shrink-0 rounded-full p-1 ${iconColorClass}`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
