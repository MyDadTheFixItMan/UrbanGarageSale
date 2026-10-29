allprojects {
    repositories {
        google()
        mavenCentral()
    }
    // flutter_stripe 10 declares Stripe's card push-provisioning library (adding cards to Google
    // Wallet), which depends on Google's private play-services-tapandpay artifact. The app doesn't
    // use push provisioning, and the artifact isn't published, so release builds can't resolve it.
    configurations.configureEach {
        exclude(group = "com.google.android.gms", module = "play-services-tapandpay")
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
