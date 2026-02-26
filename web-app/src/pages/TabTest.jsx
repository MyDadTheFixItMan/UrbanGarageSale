import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TabTest() {
    const [activeTab, setActiveTab] = useState('tab1');

    console.log('TabTest rendered with activeTab:', activeTab);

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Tab Test</h1>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Test Tabs - Value: {activeTab}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={(newValue) => {
                            console.log('onValueChange called with:', newValue);
                            setActiveTab(newValue);
                        }} className="w-full">
                            <TabsList className="bg-white border">
                                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                                <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                                <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                            </TabsList>

                            <TabsContent value="tab1" className="mt-4 p-4 bg-blue-50 rounded">
                                <p>This is Tab 1 content</p>
                            </TabsContent>

                            <TabsContent value="tab2" className="mt-4 p-4 bg-green-50 rounded">
                                <p>This is Tab 2 content</p>
                            </TabsContent>

                            <TabsContent value="tab3" className="mt-4 p-4 bg-purple-50 rounded">
                                <p>This is Tab 3 content</p>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
