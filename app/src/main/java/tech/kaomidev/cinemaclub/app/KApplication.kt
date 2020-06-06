package tech.kaomidev.cinemaclub.app

import android.app.Application
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin
import tech.kaomidev.cinemaclub.di.modules.domainModule
import tech.kaomidev.cinemaclub.di.modules.viewModule
import java.io.File

class KApplication: Application() {

    override fun onCreate() {
        super.onCreate()
        application = this

        startKoin {
            androidContext(application)
            modules(listOf(domainModule, viewModule))
        }
    }

    companion object {
        private lateinit var application: KApplication
        val cacheDir: File get() = application.cacheDir
    }
}