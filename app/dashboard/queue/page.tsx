'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/app-layout';

interface ScheduledContent {
  id: string;
  platform: string;
  type: string;
  content: {
    caption?: string;
    hook?: string;
    hashtags?: string;
    cta?: string;
    mediaUrl?: string;
  };
  status: string;
  scheduledFor: string;
  publishedAt?: string;
  performance?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
  };
  createdAt: string;
}

interface CalendarDay {
  date: Date;
  posts: ScheduledContent[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

export default function QueuePage() {
  const { data: session } = useSession();
  const [scheduledContent, setScheduledContent] = useState<ScheduledContent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [isLoading, setIsLoading] = useState(true);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ScheduledContent | null>(null);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleTime, setNewScheduleTime] = useState('');

  useEffect(() => {
    if (session?.user?.id) {
      fetchScheduledContent();
    }
  }, [session]);

  const fetchScheduledContent = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/content/scheduled');
      if (response.ok) {
        const data = await response.json();
        setScheduledContent(data);
      }
    } catch (error) {
      console.error('Error fetching scheduled content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedContent || !newScheduleDate || !newScheduleTime) return;

    try {
      const newDateTime = new Date(`${newScheduleDate}T${newScheduleTime}`);
      const response = await fetch(`/api/content/${selectedContent.id}/reschedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduledFor: newDateTime.toISOString()
        }),
      });

      if (response.ok) {
        await fetchScheduledContent();
        setShowRescheduleDialog(false);
        setSelectedContent(null);
        setNewScheduleDate('');
        setNewScheduleTime('');
      }
    } catch (error) {
      console.error('Error rescheduling content:', error);
    }
  };

  const handleDeleteFromQueue = async (contentId: string) => {
    if (!confirm('Are you sure you want to remove this content from the queue?')) return;

    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setScheduledContent(prev => prev.filter(c => c.id !== contentId));
      }
    } catch (error) {
      console.error('Error deleting content:', error);
    }
  };

  const generateCalendar = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();

    const days: CalendarDay[] = [];

    // Add previous month's trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        posts: [],
        isToday: false,
        isCurrentMonth: false
      });
    }

    // Add current month's days
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const date = new Date(year, month, day);
      const posts = scheduledContent.filter(content => {
        const contentDate = new Date(content.scheduledFor);
        return contentDate.toDateString() === date.toDateString();
      });

      days.push({
        date,
        posts,
        isToday: date.toDateString() === new Date().toDateString(),
        isCurrentMonth: true
      });
    }

    // Add next month's leading days to complete the grid
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        posts: [],
        isToday: false,
        isCurrentMonth: false
      });
    }

    return days;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'published':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        );
      case 'twitter':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const calendar = generateCalendar();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading publishing queue...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Publishing Queue</h1>
            <p className="text-muted-foreground">
              Manage your scheduled content and publishing calendar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              onClick={() => setViewMode('calendar')}
              size="sm"
            >
              Calendar
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              size="sm"
            >
              List
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Scheduled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduledContent.filter(c => c.status === 'scheduled').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Published Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduledContent.filter(c => {
                  if (c.status !== 'published' || !c.publishedAt) return false;
                  const today = new Date().toDateString();
                  return new Date(c.publishedAt).toDateString() === today;
                }).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {scheduledContent.filter(c => c.status === 'failed').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Next 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduledContent.filter(c => {
                  const contentDate = new Date(c.scheduledFor);
                  const now = new Date();
                  const nextWeek = new Date();
                  nextWeek.setDate(now.getDate() + 7);
                  return contentDate >= now && contentDate <= nextWeek;
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {viewMode === 'calendar' ? (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                  >
                    ←
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                  >
                    →
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendar.map((day, index) => (
                  <div
                    key={index}
                    className={`min-h-24 p-2 border rounded-md ${
                      day.isCurrentMonth ? 'bg-background' : 'bg-muted/50'
                    } ${day.isToday ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className={`text-sm ${day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {day.date.getDate()}
                    </div>
                    <div className="space-y-1 mt-1">
                      {day.posts.slice(0, 3).map((post) => (
                        <div
                          key={post.id}
                          className="text-xs p-1 rounded bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                          onClick={() => {
                            setSelectedContent(post);
                            setShowRescheduleDialog(true);
                            setNewScheduleDate(post.scheduledFor.split('T')[0]);
                            setNewScheduleTime(post.scheduledFor.split('T')[1].slice(0, 5));
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {getPlatformIcon(post.platform)}
                            <span className="truncate">{formatTime(post.scheduledFor)}</span>
                          </div>
                        </div>
                      ))}
                      {day.posts.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{day.posts.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {scheduledContent.length > 0 ? (
              scheduledContent
                .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
                .map((content) => (
                  <Card key={content.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(content.platform)}
                            <span className="font-medium capitalize">{content.platform}</span>
                          </div>
                          <Badge variant="outline" className={getStatusColor(content.status)}>
                            {content.status}
                          </Badge>
                          <Badge variant="secondary">{content.type}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {new Date(content.scheduledFor).toLocaleString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedContent(content);
                              setShowRescheduleDialog(true);
                              setNewScheduleDate(content.scheduledFor.split('T')[0]);
                              setNewScheduleTime(content.scheduledFor.split('T')[1].slice(0, 5));
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFromQueue(content.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {content.content.hook && (
                          <div>
                            <span className="text-sm font-medium">Hook: </span>
                            <span className="text-sm">{content.content.hook}</span>
                          </div>
                        )}
                        {content.content.caption && (
                          <div>
                            <span className="text-sm font-medium">Caption: </span>
                            <span className="text-sm">{content.content.caption.slice(0, 100)}...</span>
                          </div>
                        )}
                        {content.content.hashtags && (
                          <div>
                            <span className="text-sm font-medium">Hashtags: </span>
                            <span className="text-sm text-blue-600">{content.content.hashtags}</span>
                          </div>
                        )}
                        {content.performance && (
                          <div className="pt-2 border-t">
                            <div className="flex gap-4 text-sm">
                              {content.performance.likes && (
                                <span>❤️ {content.performance.likes}</span>
                              )}
                              {content.performance.comments && (
                                <span>💬 {content.performance.comments}</span>
                              )}
                              {content.performance.shares && (
                                <span>🔄 {content.performance.shares}</span>
                              )}
                              {content.performance.reach && (
                                <span>👁️ {content.performance.reach}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No scheduled content found.</p>
                  <p className="text-sm text-muted-foreground">
                    Create some content and schedule it to see it here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reschedule Content</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-date">New Date</Label>
                  <Input
                    id="new-date"
                    type="date"
                    value={newScheduleDate}
                    onChange={(e) => setNewScheduleDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-time">New Time</Label>
                  <Input
                    id="new-time"
                    type="time"
                    value={newScheduleTime}
                    onChange={(e) => setNewScheduleTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRescheduleDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReschedule}>
                  Reschedule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}