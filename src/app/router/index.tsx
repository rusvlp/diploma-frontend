import {BrowserRouter, Routes, Route} from "react-router-dom";
import LoginPage from "@/pages/LoginPage/LoginPage";
import SignUpPage from "@/pages/SignUpPage/SignUpPage";
import HomePage from "@/pages/HomePage/HomePage.tsx";
import CreateCoursePage from "@/pages/CreateCoursePage/CreateCoursePage.tsx";
import CoursePage from "@/pages/CoursePage/CoursePage.tsx";
import Layout from "@/components/Layout/Layout.tsx";
import CreateModulePage from "@/pages/CreateModulePage/CreateModulePage.tsx";
import ModulePage from "@/pages/ModulePage/ModulePage.tsx";
import CreateLessonPage from "@/pages/CreateLessonPage/CreateLessonPage.tsx";
import LessonPage from "@/pages/LessonPage/LessonPage.tsx";
import TerrainPage from "@/pages/TerrainPage/TerrainPage.tsx";
import LocationsPage from "@/pages/LocationsPage/LocationsPage.tsx";
import ProfilePage from "@/pages/ProfilePage/ProfilePage.tsx";
import CreateTestPage from "@/pages/CreateTestPage/CreateTestPage.tsx";
import CreateGroupPage from "@/pages/CreateGroupPage/CreateGroupPage.tsx";
import GroupPage from "@/pages/GroupPage/GroupPage.tsx";

export const AppRouter = () => (
    <BrowserRouter>
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />

            <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/profile" element={<ProfilePage/>} />
                <Route path="/courses/create" element={<CreateCoursePage />} />
                <Route path="/courses/:courseId" element={<CoursePage />} />
                <Route path="/courses/:id/modules/create" element={<CreateModulePage/>}/>
                <Route path="/modules/:moduleId" element={<ModulePage />} />
                <Route path="/modules/:id/lessons/create" element={<CreateLessonPage/>}/>
                <Route path="/lessons/:id" element={<LessonPage />} />
                <Route path="/modules/:moduleId/tests/create" element={<CreateTestPage/>}/>
                <Route path="/courses/:courseId/tests/create" element={<CreateTestPage/>}/>
                {/*<Route path="/modules/:moduleId/test" element={<TestPage />} />*/}
                <Route path="/groups/create" element={<CreateGroupPage/>}/>
                <Route path="/groups" element={<GroupPage/>}/>
                <Route path="/terrain" element={<TerrainPage />} />
                <Route path="/locations" element={<LocationsPage />} />
            </Route>
        </Routes>
    </BrowserRouter>
);