import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Upload, RotateCcw, Users, TrendingUp, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

interface Stats {
  photosTaken: number;
  photosUploaded: number;
  respins: number;
  totalGames: number;
  avgFaces: number;
  recentActivity: { date: string; count: number }[];
}

export default function StatsPage() {
  const [, navigate] = useLocation();

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const maxActivity = stats?.recentActivity?.length
    ? Math.max(...stats.recentActivity.map((d) => d.count))
    : 1;

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="stats-page">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-stats-title">Usage Dashboard</h1>
            <p className="text-sm text-muted-foreground">Track how the app is being used</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-16 animate-pulse bg-muted rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-photos-taken">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Photos Taken
                  </CardTitle>
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-photos-taken-count">
                    {stats.photosTaken}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">via camera capture</p>
                </CardContent>
              </Card>

              <Card data-testid="card-photos-uploaded">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Photos Uploaded
                  </CardTitle>
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-photos-uploaded-count">
                    {stats.photosUploaded}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">from device gallery</p>
                </CardContent>
              </Card>

              <Card data-testid="card-respins">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Respins
                  </CardTitle>
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-respins-count">
                    {stats.respins}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">second chances given</p>
                </CardContent>
              </Card>

              <Card data-testid="card-avg-faces">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Group Size
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-avg-faces-count">
                    {stats.avgFaces}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">faces per photo</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card data-testid="card-total-games">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Games Played</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-5xl font-bold text-center py-6" data-testid="text-total-games-count">
                    {stats.totalGames}
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {stats.photosTaken + stats.photosUploaded + stats.respins} total interactions
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-activity-chart">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {stats.recentActivity.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                      No activity yet
                    </div>
                  ) : (
                    <div className="flex items-end gap-1" style={{ height: "128px" }} data-testid="chart-activity">
                      {stats.recentActivity.map((day) => {
                        const barHeight = Math.max((day.count / maxActivity) * 120, 6);
                        return (
                        <div
                          key={day.date}
                          className="flex-1 min-w-0 group relative"
                        >
                          <div
                            className="bg-primary rounded-t-sm transition-all w-full"
                            style={{
                              height: `${barHeight}px`,
                            }}
                          />
                          <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md whitespace-nowrap border z-10">
                            {day.date}: {day.count} events
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Failed to load stats. Please try again.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
